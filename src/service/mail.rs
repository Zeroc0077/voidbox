use worker::*;
use mail_parser::MessageParser;
use email_address::EmailAddress;
use super::{get_env_usize, get_env_bool, get_env_list, DEFAULT_MAX_MAILS, DEFAULT_MAX_MAIL_SIZE};
use crate::repo;
use crate::repo::now_secs;
use crate::service;
use crate::types::*;

/// Receive a raw email from the JS email handler.
///
/// Flow: validate size → detect relay type → resolve inbox/from → check inbox active → parse MIME → store → trim.
pub async fn receive_email(raw: &[u8], to: &str, env: &Env) -> Result<()> {
    let max_size = get_env_usize(env, "MAX_MAIL_SIZE", DEFAULT_MAX_MAIL_SIZE);
    if raw.len() > max_size {
        return Err(Error::from("Email too large"));
    }

    let relay_addresses = get_env_list(env, "RELAY_ADDRESSES");
    let is_relay_candidate = get_env_bool(env, "RELAY_ENABLED")
        && relay_addresses.contains(&to.to_lowercase());

    if is_relay_candidate {
        let relay_domains = get_env_list(env, "RELAY_DOMAINS");
        let parsed = MessageParser::default().parse(raw)
            .ok_or_else(|| Error::from("Failed to parse email"))?;

        match detect_relay_type(&parsed) {
            RelayType::SimpleLogin => receive_simplelogin(raw, &parsed, &relay_domains, env).await,
            RelayType::FirefoxRelay => receive_firefox_relay(raw, &parsed, &relay_domains, env).await,
            RelayType::None => receive_direct_email(raw, to, env).await,
        }
    } else {
        receive_direct_email(raw, to, env).await
    }
}

enum RelayType {
    SimpleLogin,
    FirefoxRelay,
    None,
}

/// Auto-detect relay provider from email headers.
fn detect_relay_type(parsed: &mail_parser::Message) -> RelayType {
    for header in parsed.headers() {
        match header.name() {
            "X-SimpleLogin-Type" => return RelayType::SimpleLogin,
            "Resent-From" => return RelayType::FirefoxRelay,
            _ => {}
        }
    }
    RelayType::None
}

/// Normal (non-relay) email receive path.
async fn receive_direct_email(raw: &[u8], to: &str, env: &Env) -> Result<()> {
    let inbox = to.to_lowercase();
    if !EmailAddress::is_valid(&inbox) {
        return Err(Error::from("Malformed email address"));
    }

    if !service::inbox::is_active(env, &inbox).await? {
        return Err(Error::from("Inbox not registered"));
    }

    let entry = parse_mime(raw, &inbox, None)?;
    save_and_trim(env, &entry).await
}

/// Firefox Relay: inbox = From header (mask address), from = Resent-From header (real sender).
async fn receive_firefox_relay(raw: &[u8], parsed: &mail_parser::Message<'_>, relay_domains: &[String], env: &Env) -> Result<()> {
    let inbox = parsed.from()
        .and_then(|a| a.first())
        .and_then(|a| a.address())
        .map(|s| s.to_lowercase())
        .ok_or_else(|| Error::from("Relay email missing From header"))?;

    validate_relay_inbox(&inbox, relay_domains)?;

    let from_override = extract_header_address(parsed, "Resent-From");

    if !service::inbox::is_active(env, &inbox).await? {
        return Err(Error::from("Inbox not registered"));
    }

    let entry = parse_mime(raw, &inbox, from_override.as_deref())?;
    save_and_trim(env, &entry).await
}

/// SimpleLogin: inbox = To header (alias address), from = X-SimpleLogin-Original-From header (real sender).
async fn receive_simplelogin(raw: &[u8], parsed: &mail_parser::Message<'_>, relay_domains: &[String], env: &Env) -> Result<()> {
    let inbox = parsed.to()
        .and_then(|a| a.first())
        .and_then(|a| a.address())
        .map(|s| s.to_lowercase())
        .ok_or_else(|| Error::from("SimpleLogin email missing To header"))?;

    validate_relay_inbox(&inbox, relay_domains)?;

    let from_override = extract_header_text(parsed, "X-SimpleLogin-Original-From")
        .and_then(|s| extract_address_from_text(&s))
        .or_else(|| extract_header_text(parsed, "X-SimpleLogin-Envelope-From"));

    if !service::inbox::is_active(env, &inbox).await? {
        return Err(Error::from("Inbox not registered"));
    }

    let entry = parse_mime(raw, &inbox, from_override.as_deref())?;
    save_and_trim(env, &entry).await
}

/// Validate that a relay inbox address is well-formed and its domain is in RELAY_DOMAINS.
fn validate_relay_inbox(inbox: &str, relay_domains: &[String]) -> Result<()> {
    if !EmailAddress::is_valid(inbox) {
        return Err(Error::from("Malformed relay address"));
    }
    let domain = inbox.rsplit_once('@').map(|(_, d)| d).unwrap_or("");
    if !relay_domains.contains(&domain.to_string()) {
        return Err(Error::from("Domain not in RELAY_DOMAINS"));
    }
    Ok(())
}

/// Extract an address from a header that is parsed as Address type (e.g. Resent-From).
fn extract_header_address(parsed: &mail_parser::Message, name: &str) -> Option<String> {
    for header in parsed.headers() {
        if header.name() == name {
            if let mail_parser::HeaderValue::Address(addr) = header.value() {
                return addr.first()
                    .and_then(|a| a.address())
                    .map(|s| s.to_string());
            }
        }
    }
    None
}

/// Extract text from a header (e.g. X-SimpleLogin-Original-From).
fn extract_header_text(parsed: &mail_parser::Message, name: &str) -> Option<String> {
    for header in parsed.headers() {
        if header.name() == name {
            return match header.value() {
                mail_parser::HeaderValue::Text(t) => Some(t.to_string()),
                mail_parser::HeaderValue::Address(a) => {
                    a.first().and_then(|addr| addr.address()).map(|s| s.to_string())
                }
                _ => None,
            };
        }
    }
    None
}

/// Extract email address from a display-name + address string like "Hurrison <admin@hurrison.com>".
fn extract_address_from_text(text: &str) -> Option<String> {
    if let Some(start) = text.rfind('<') {
        if let Some(end) = text.rfind('>') {
            if start < end {
                return Some(text[start + 1..end].trim().to_string());
            }
        }
    }
    // If no angle brackets, treat the whole string as an address
    let trimmed = text.trim();
    if trimmed.contains('@') {
        Some(trimmed.to_string())
    } else {
        None
    }
}

/// Parse raw MIME bytes into a structured MailEntry.
/// Extracts sender, subject, body (text + HTML), and headers.
/// If `from_override` is provided (relay mode), it replaces the From-derived sender.
fn parse_mime(raw: &[u8], inbox: &str, from_override: Option<&str>) -> Result<MailEntry> {
    let parsed = MessageParser::default().parse(raw)
        .ok_or_else(|| Error::from("Failed to parse email"))?;

    let from = from_override
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            parsed.from()
                .and_then(|a| a.first())
                .and_then(|a| a.address())
                .unwrap_or_default()
                .to_string()
        });

    let mut header_map = serde_json::Map::new();
    for header in parsed.headers() {
        let name = header.name().to_string();
        let value = match header.value() {
            mail_parser::HeaderValue::Text(t) => t.to_string(),
            mail_parser::HeaderValue::Address(a) => {
                a.first()
                    .and_then(|addr| addr.address())
                    .unwrap_or_default()
                    .to_string()
            }
            _ => String::new(),
        };
        if !value.is_empty() {
            header_map.insert(name, serde_json::Value::String(value));
        }
    }

    Ok(MailEntry {
        id: nanoid::nanoid!(10),
        from,
        inbox: inbox.to_string(),
        subject: parsed.subject().unwrap_or("").to_string(),
        text: parsed.body_text(0).unwrap_or_default().to_string(),
        html: parsed.body_html(0).unwrap_or_default().to_string(),
        headers: serde_json::Value::Object(header_map),
    })
}

/// Persist a parsed email and enforce the per-inbox mail limit.
async fn save_and_trim(env: &Env, entry: &MailEntry) -> Result<()> {
    let db = repo::get_db(env)?;
    let received_at = now_secs();
    let headers_json = serde_json::to_string(&entry.headers).unwrap_or_default();

    repo::mail::save(&db, entry, received_at, &headers_json).await?;

    let max = get_env_usize(env, "MAX_MAILS_PER_INBOX", DEFAULT_MAX_MAILS);
    repo::mail::trim_to_limit(&db, &entry.inbox, max).await?;

    Ok(())
}

/// List all emails in an inbox, newest first.
pub async fn list_all(env: &Env, inbox: &str) -> Result<Vec<MailMeta>> {
    let db = repo::get_db(env)?;
    let rows = repo::mail::find_all(&db, inbox).await?;
    Ok(rows.into_iter().map(row_to_meta).collect())
}

/// List emails filtered by exact sender address.
pub async fn list_from_sender(env: &Env, inbox: &str, sender: &str) -> Result<Vec<MailMeta>> {
    let db = repo::get_db(env)?;
    let rows = repo::mail::find_by_sender(&db, inbox, sender).await?;
    Ok(rows.into_iter().map(row_to_meta).collect())
}

/// Get full email content by ID.
pub async fn get_detail(env: &Env, inbox: &str, mail_id: &str) -> Result<Option<MailEntryResponse>> {
    let db = repo::get_db(env)?;
    let row = repo::mail::find_one(&db, inbox, mail_id).await?;
    Ok(row.map(row_to_response))
}

/// Delete a single email.
pub async fn remove(env: &Env, inbox: &str, mail_id: &str) -> Result<()> {
    let db = repo::get_db(env)?;
    repo::mail::remove(&db, inbox, mail_id).await
}

/// Delete all emails in an inbox, keeping the inbox itself active.
pub async fn clear_all(env: &Env, inbox: &str) -> Result<()> {
    let db = repo::get_db(env)?;
    repo::mail::remove_all(&db, inbox).await
}

fn row_to_meta(r: MailRow) -> MailMeta {
    MailMeta {
        id: r.id,
        from: r.from_addr,
        subject: r.subject,
        received_at: r.received_at as u64,
    }
}

fn row_to_response(r: FullMailRow) -> MailEntryResponse {
    MailEntryResponse {
        id: r.id,
        from: r.from_addr,
        inbox: r.inbox_id,
        subject: r.subject,
        text: r.text_body,
        html: r.html_body,
        headers: serde_json::from_str(&r.headers).unwrap_or(serde_json::Value::Object(Default::default())),
        received_at: r.received_at as u64,
    }
}

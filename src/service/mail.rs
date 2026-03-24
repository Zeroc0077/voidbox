use worker::*;
use mail_parser::MessageParser;
use super::{get_env_usize, DEFAULT_MAX_MAILS, DEFAULT_MAX_MAIL_SIZE};
use crate::repo;
use crate::repo::now_secs;
use crate::service;
use crate::types::*;

/// Receive a raw email from the JS email handler.
///
/// Flow: validate size → validate recipient → check inbox active → parse MIME → store → trim.
pub async fn receive_email(raw: &[u8], to: &str, env: &Env) -> Result<()> {
    let max_size = get_env_usize(env, "MAX_MAIL_SIZE", DEFAULT_MAX_MAIL_SIZE);
    if raw.len() > max_size {
        return Err(Error::from("Email too large"));
    }

    let inbox = to.to_lowercase();
    if inbox.is_empty() || !inbox.contains('@') {
        return Err(Error::from("Malformed email address"));
    }

    if !service::inbox::is_active(env, &inbox).await? {
        return Err(Error::from("Inbox not registered"));
    }

    let entry = parse_mime(raw, &inbox)?;
    save_and_trim(env, &entry).await
}

/// Parse raw MIME bytes into a structured MailEntry.
/// Extracts sender, subject, body (text + HTML), forwarding info, and headers.
fn parse_mime(raw: &[u8], inbox: &str) -> Result<MailEntry> {
    let parsed = MessageParser::default().parse(raw)
        .ok_or_else(|| Error::from("Failed to parse email"))?;

    let from = parsed.from()
        .and_then(|a| a.first())
        .and_then(|a| a.address())
        .unwrap_or_default()
        .to_string();

    // Return-Path indicates the actual forwarding source; fall back to From
    let forward_from = parsed.return_address()
        .map(|s| s.to_string())
        .unwrap_or_else(|| from.clone());

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
        forward_from,
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

/// List emails filtered by exact forwarding source.
pub async fn list_from_forwarder(env: &Env, inbox: &str, forwarder: &str) -> Result<Vec<MailMeta>> {
    let db = repo::get_db(env)?;
    let rows = repo::mail::find_by_forwarder(&db, inbox, forwarder).await?;
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
        forward_from: r.forward_from,
        subject: r.subject,
        received_at: r.received_at as u64,
    }
}

fn row_to_response(r: FullMailRow) -> MailEntryResponse {
    MailEntryResponse {
        id: r.id,
        from: r.from_addr,
        forward_from: r.forward_from,
        inbox: r.inbox_id,
        subject: r.subject,
        text: r.text_body,
        html: r.html_body,
        headers: serde_json::from_str(&r.headers).unwrap_or(serde_json::Value::Object(Default::default())),
        received_at: r.received_at as u64,
    }
}

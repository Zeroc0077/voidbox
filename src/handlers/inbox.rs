//! Inbox management handlers.
//!
//! Handles inbox registration, deletion, email listing, TTL status and renewal.

use worker::*;
use email_address::EmailAddress;
use super::{decode_param, get_mail_domains, json_response};
use crate::service;
use crate::service::{get_env_bool, get_env_list};
use crate::types::*;

/// Validate that an inbox address is a valid email and uses an allowed domain.
/// Checks against both MAIL_DOMAINS and (if relay enabled) RELAY_DOMAINS.
fn is_valid_inbox(inbox: &str, mail_domains: &[String], relay_domains: &[String]) -> bool {
    if !EmailAddress::is_valid(inbox) {
        return false;
    }
    let domain = inbox.split_once('@').unwrap().1;
    let matches_mail = mail_domains.iter().any(|d| {
        if let Some(suffix) = d.strip_prefix("*.") {
            domain.ends_with(suffix) && domain.len() > suffix.len() + 1 && domain.as_bytes()[domain.len() - suffix.len() - 1] == b'.'
        } else {
            d == domain
        }
    });
    if matches_mail { return true; }
    relay_domains.iter().any(|d| d == domain)
}

/// POST /api/inbox/:inbox
///
/// Register a new temporary inbox. The `:inbox` param is a full email address
/// (e.g., `test%40domain.com`). Validates the local part and domain against
/// the allowed list before creating.
///
/// - 201: `{"inbox", "createdAt", "expiresAt"}` on success
/// - 400: invalid address or domain
/// - 409: inbox already registered
/// - 500: internal error
pub async fn register(inbox_param: &str, env: &Env) -> Result<Response> {
    let inbox = decode_param(inbox_param);
    let mail_domains = get_mail_domains(env);
    let relay_domains = if get_env_bool(env, "RELAY_ENABLED") { get_env_list(env, "RELAY_DOMAINS") } else { vec![] };
    if !is_valid_inbox(&inbox, &mail_domains, &relay_domains) {
        return json_response(&ErrorResponse { error: "Invalid inbox address".into() }, 400);
    }
    match service::inbox::register(env, &inbox).await {
        Ok(resp) => json_response(&resp, 201),
        Err(e) if e.to_string().contains("already registered") => {
            json_response(&ErrorResponse { error: "Inbox already registered".into() }, 409)
        }
        Err(e) => json_response(&ErrorResponse { error: format!("{}", e) }, 500),
    }
}

/// DELETE /api/inbox/:inbox
///
/// Permanently delete an inbox and all its emails (CASCADE).
///
/// - 200: `{"ok": true}`
pub async fn delete(inbox_param: &str, env: &Env) -> Result<Response> {
    service::inbox::destroy(env, &decode_param(inbox_param)).await?;
    json_response(&OkResponse { ok: true }, 200)
}

/// DELETE /api/inbox/:inbox/emails
///
/// Delete all emails in an inbox without removing the inbox itself.
/// The inbox remains active and can continue receiving new emails.
///
/// - 200: `{"ok": true}`
pub async fn clear_emails(inbox_param: &str, env: &Env) -> Result<Response> {
    service::mail::clear_all(env, &decode_param(inbox_param)).await?;
    json_response(&OkResponse { ok: true }, 200)
}

/// GET /api/inbox/:inbox
///
/// List all emails in an inbox, sorted by newest first.
///
/// - 200: `{"emails": [{"id", "from", "subject", "receivedAt"}]}`
pub async fn list(inbox_param: &str, env: &Env) -> Result<Response> {
    let emails = service::mail::list_all(env, &decode_param(inbox_param)).await?;
    json_response(&InboxResponse { emails }, 200)
}

/// GET /api/inbox/:inbox/from/:from
///
/// List emails filtered by exact sender address (case-insensitive).
///
/// - 200: same shape as list
pub async fn list_by_from(inbox_param: &str, from_param: &str, env: &Env) -> Result<Response> {
    let emails = service::mail::list_from_sender(env, &decode_param(inbox_param), &decode_param(from_param)).await?;
    json_response(&InboxResponse { emails }, 200)
}

/// GET /api/inbox/:inbox/status
///
/// Get the current TTL status of an inbox.
///
/// - 200: `{"inbox", "createdAt", "expiresAt"}`
/// - 404: inbox not found or expired
pub async fn status(inbox_param: &str, env: &Env) -> Result<Response> {
    match service::inbox::get_status(env, &decode_param(inbox_param)).await? {
        Some(s) => json_response(&s, 200),
        None => json_response(&ErrorResponse { error: "Inbox not found or expired".into() }, 404),
    }
}

/// PUT /api/inbox/:inbox/renew
///
/// Extend the inbox TTL by 1 hour from now.
///
/// - 200: `{"inbox", "createdAt", "expiresAt"}` with updated expiration
/// - 404: inbox not found or already expired
pub async fn renew(inbox_param: &str, env: &Env) -> Result<Response> {
    match service::inbox::renew(env, &decode_param(inbox_param)).await? {
        Some(s) => json_response(&s, 200),
        None => json_response(&ErrorResponse { error: "Inbox not found or expired".into() }, 404),
    }
}

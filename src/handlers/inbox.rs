//! Inbox management handlers.
//!
//! Handles inbox registration, deletion, email listing, TTL status and renewal.

use worker::*;
use super::{decode_param, get_mail_domains, json_response};
use crate::service;
use crate::types::*;

/// Validate that an inbox address has a valid local part and an allowed domain.
/// Local part: 1-64 chars, alphanumeric + `.` `_` `-` `+` only.
fn is_valid_inbox(inbox: &str, domains: &[String]) -> bool {
    let Some((local, domain)) = inbox.split_once('@') else { return false };
    if local.is_empty() || local.len() > 64 {
        return false;
    }
    if !local.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-+".contains(&b)) {
        return false;
    }
    domains.iter().any(|d| d == domain)
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
    if !is_valid_inbox(&inbox, &get_mail_domains(env)) {
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
/// - 200: `{"emails": [{"id", "from", "forwardFrom", "subject", "receivedAt"}]}`
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

/// GET /api/inbox/:inbox/forward_from/:from
///
/// List emails filtered by exact forwarding source (case-insensitive).
///
/// - 200: same shape as list
pub async fn list_by_forward(inbox_param: &str, from_param: &str, env: &Env) -> Result<Response> {
    let emails = service::mail::list_from_forwarder(env, &decode_param(inbox_param), &decode_param(from_param)).await?;
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

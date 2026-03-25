//! Email content handlers.
//!
//! Handles reading and deleting individual emails within an inbox.

use worker::*;
use super::{decode_param, json_response};
use crate::service;
use crate::types::*;

/// GET /api/mail/:inbox/:id
///
/// Retrieve full email content including text body, HTML body, and headers.
///
/// - 200: `{"id", "from", "inbox", "subject", "text", "html", "headers", "receivedAt"}`
/// - 404: email not found
pub async fn get(inbox_param: &str, id: &str, env: &Env) -> Result<Response> {
    match service::mail::get_detail(env, &decode_param(inbox_param), id).await? {
        Some(mail) => json_response(&mail, 200),
        None => json_response(&ErrorResponse { error: "Not found".into() }, 404),
    }
}

/// DELETE /api/mail/:inbox/:id
///
/// Delete a single email from an inbox.
///
/// - 200: `{"ok": true}`
pub async fn delete(inbox_param: &str, id: &str, env: &Env) -> Result<Response> {
    service::mail::remove(env, &decode_param(inbox_param), id).await?;
    json_response(&OkResponse { ok: true }, 200)
}

//! Handler utilities shared across all route handlers.

pub mod config;
pub mod inbox;
pub mod mail;

use worker::*;

/// Decode a percent-encoded URL path parameter and normalize to lowercase.
pub fn decode_param(s: &str) -> String {
    urlencoding::decode(s).unwrap_or_else(|_| s.into()).to_lowercase()
}

/// Serialize data as JSON and return an HTTP response with the given status code.
pub fn json_response<T: serde::Serialize>(data: &T, status: u16) -> Result<Response> {
    Response::from_json(data).map(|r| r.with_status(status))
}

/// Read the MAIL_DOMAINS env var and return a list of allowed email domains.
pub fn get_mail_domains(env: &Env) -> Vec<String> {
    env.var("MAIL_DOMAINS")
        .map(|v| v.to_string())
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

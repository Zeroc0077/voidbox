//! Configuration handler.

use worker::*;
use super::{get_mail_domains, json_response};

/// GET /api/config
///
/// Returns the list of allowed email domains for inbox registration.
/// Used by the frontend to populate the domain dropdown.
///
/// Response: `{"mailDomains": ["domain1.com", "domain2.com"]}`
pub async fn get_config(env: &Env) -> Result<Response> {
    json_response(&serde_json::json!({"mailDomains": get_mail_domains(env)}), 200)
}

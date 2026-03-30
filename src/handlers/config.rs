//! Configuration handler.

use worker::*;
use super::{get_mail_domains, json_response};
use crate::service::{get_env_bool, get_env_list};

/// GET /api/config
///
/// Returns the list of allowed email domains for inbox registration,
/// plus relay configuration if enabled.
///
/// Response: `{"mailDomains": [...], "relayEnabled": bool, "relayDomains": [...]}`
pub async fn get_config(env: &Env) -> Result<Response> {
    let relay_enabled = get_env_bool(env, "RELAY_ENABLED");
    let relay_domains = if relay_enabled { get_env_list(env, "RELAY_DOMAINS") } else { vec![] };

    json_response(&serde_json::json!({
        "mailDomains": get_mail_domains(env),
        "relayEnabled": relay_enabled,
        "relayDomains": relay_domains,
    }), 200)
}

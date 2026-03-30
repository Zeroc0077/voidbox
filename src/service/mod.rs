pub mod inbox;
pub mod mail;

use worker::Env;

const DEFAULT_TTL: u64 = 3600;
const DEFAULT_MAX_MAILS: usize = 100;
const DEFAULT_MAX_INBOXES: usize = 50;
const DEFAULT_MAX_MAIL_SIZE: usize = 256 * 1024; // 256 KB

pub fn get_env_usize(env: &Env, name: &str, default: usize) -> usize {
    env.var(name)
        .ok()
        .and_then(|v| v.to_string().parse().ok())
        .unwrap_or(default)
}

pub fn get_env_bool(env: &Env, name: &str) -> bool {
    env.var(name)
        .ok()
        .map(|v| v.to_string().eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

pub fn get_env_list(env: &Env, name: &str) -> Vec<String> {
    env.var(name)
        .map(|v| v.to_string())
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

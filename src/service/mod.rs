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

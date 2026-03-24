use worker::*;
use super::{get_env_usize, DEFAULT_TTL, DEFAULT_MAX_INBOXES};
use crate::repo;
use crate::repo::now_secs;
use crate::types::*;

/// Register a new temporary inbox.
///
/// Flow: purge expired → check duplicate → enforce capacity → create.
/// Returns the registered inbox with its TTL timestamps.
pub async fn register(env: &Env, inbox: &str) -> Result<RegisterResponse> {
    let db = repo::get_db(env)?;

    // Reclaim expired slots before checking capacity
    let _ = repo::inbox::purge_expired(&db).await;

    let (count, already_exists) = repo::inbox::count_with_existence(&db, inbox).await?;
    if already_exists {
        return Err(Error::from("Inbox already registered"));
    }

    // Evict the oldest inbox if at capacity (FIFO)
    let max = get_env_usize(env, "MAX_INBOXES", DEFAULT_MAX_INBOXES);
    if count >= max {
        repo::inbox::remove_oldest(&db).await?;
    }

    let now = now_secs();
    let expires_at = now + DEFAULT_TTL;
    repo::inbox::create(&db, inbox, now, expires_at).await?;

    Ok(RegisterResponse {
        inbox: inbox.to_string(),
        created_at: now,
        expires_at,
    })
}

/// Check if an inbox is currently active (registered and not expired).
pub async fn is_active(env: &Env, inbox: &str) -> Result<bool> {
    let db = repo::get_db(env)?;
    repo::inbox::is_active(&db, inbox).await
}

/// Get the current TTL status of an inbox.
/// Returns None if the inbox has expired or was never registered.
pub async fn get_status(env: &Env, inbox: &str) -> Result<Option<InboxStatusResponse>> {
    let db = repo::get_db(env)?;
    let timestamps = repo::inbox::get_ttl(&db, inbox).await?;
    Ok(timestamps.map(|(created_at, expires_at)| InboxStatusResponse {
        inbox: inbox.to_string(),
        created_at,
        expires_at,
    }))
}

/// Extend the inbox's TTL by one full period from now.
/// Returns the updated status, or None if the inbox has already expired.
pub async fn renew(env: &Env, inbox: &str) -> Result<Option<InboxStatusResponse>> {
    let db = repo::get_db(env)?;
    let new_expires_at = now_secs() + DEFAULT_TTL;
    repo::inbox::extend_ttl(&db, inbox, new_expires_at).await?;
    // Read back with same db handle to avoid second get_db()
    let timestamps = repo::inbox::get_ttl(&db, inbox).await?;
    Ok(timestamps.map(|(created_at, expires_at)| InboxStatusResponse {
        inbox: inbox.to_string(),
        created_at,
        expires_at,
    }))
}

/// Permanently delete an inbox and all its emails.
pub async fn destroy(env: &Env, inbox: &str) -> Result<()> {
    let db = repo::get_db(env)?;
    repo::inbox::remove(&db, inbox).await
}

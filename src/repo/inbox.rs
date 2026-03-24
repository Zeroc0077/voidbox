use worker::*;
use super::{bind_u64, now_secs};
use crate::types::*;

/// Remove all inboxes whose TTL has elapsed.
/// Called opportunistically before registration to reclaim slots.
pub async fn purge_expired(db: &D1Database) -> Result<()> {
    db.prepare("DELETE FROM inbox WHERE expires_at < ?1")
        .bind(&[bind_u64(now_secs())])?
        .run()
        .await?;
    Ok(())
}

/// Return total inbox count and whether a specific inbox already exists.
/// Combined into one query to minimize D1 round-trips during registration.
pub async fn count_with_existence(db: &D1Database, inbox: &str) -> Result<(usize, bool)> {
    let row = db.prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN id = ?1 THEN 1 ELSE 0 END), 0) as existing FROM inbox"
    )
        .bind(&[inbox.into()])?
        .first::<RegisterCheckRow>(None)
        .await?;
    Ok(row.map(|r| (r.count as usize, r.existing > 0)).unwrap_or((0, false)))
}

/// Delete the oldest inbox (by created_at) to make room for a new one.
/// CASCADE deletes all associated emails automatically.
pub async fn remove_oldest(db: &D1Database) -> Result<()> {
    db.prepare("DELETE FROM inbox WHERE id = (SELECT id FROM inbox ORDER BY created_at ASC LIMIT 1)")
        .bind(&[])?
        .run()
        .await?;
    Ok(())
}

/// Create a new inbox with the given TTL timestamps.
pub async fn create(db: &D1Database, inbox: &str, created_at: u64, expires_at: u64) -> Result<()> {
    db.prepare("INSERT INTO inbox (id, created_at, expires_at) VALUES (?1, ?2, ?3)")
        .bind(&[inbox.into(), bind_u64(created_at), bind_u64(expires_at)])?
        .run()
        .await?;
    Ok(())
}

/// Check whether an inbox is registered and not expired.
pub async fn is_active(db: &D1Database, inbox: &str) -> Result<bool> {
    let row = db.prepare("SELECT 1 as v FROM inbox WHERE id = ?1 AND expires_at > ?2")
        .bind(&[inbox.into(), bind_u64(now_secs())])?
        .first::<serde_json::Value>(None)
        .await?;
    Ok(row.is_some())
}

/// Retrieve creation and expiration timestamps for an active inbox.
/// Returns None if the inbox does not exist or has expired.
pub async fn get_ttl(db: &D1Database, inbox: &str) -> Result<Option<(u64, u64)>> {
    let row = db.prepare("SELECT created_at, expires_at FROM inbox WHERE id = ?1 AND expires_at > ?2")
        .bind(&[inbox.into(), bind_u64(now_secs())])?
        .first::<InboxTimestamps>(None)
        .await?;
    Ok(row.map(|r| (r.created_at as u64, r.expires_at as u64)))
}

/// Extend an active inbox's expiration time.
/// No-op if the inbox does not exist or has already expired.
pub async fn extend_ttl(db: &D1Database, inbox: &str, new_expires_at: u64) -> Result<()> {
    db.prepare("UPDATE inbox SET expires_at = ?1 WHERE id = ?2 AND expires_at > ?3")
        .bind(&[bind_u64(new_expires_at), inbox.into(), bind_u64(now_secs())])?
        .run()
        .await?;
    Ok(())
}

/// Permanently delete an inbox and all its emails (via CASCADE).
pub async fn remove(db: &D1Database, inbox: &str) -> Result<()> {
    db.prepare("DELETE FROM inbox WHERE id = ?1")
        .bind(&[inbox.into()])?
        .run()
        .await?;
    Ok(())
}

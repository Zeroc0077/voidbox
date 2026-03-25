use worker::*;
use worker::wasm_bindgen::JsValue;
use super::bind_u64;
use crate::types::*;

/// Persist a parsed email into the mail table.
pub async fn save(db: &D1Database, entry: &MailEntry, received_at: u64, headers_json: &str) -> Result<()> {
    db.prepare(
        "INSERT INTO mail (id, inbox_id, from_addr, subject, text_body, html_body, headers, received_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
        .bind(&[
            entry.id.as_str().into(),
            entry.inbox.as_str().into(),
            entry.from.as_str().into(),
            entry.subject.as_str().into(),
            entry.text.as_str().into(),
            entry.html.as_str().into(),
            headers_json.into(),
            bind_u64(received_at),
        ])?
        .run()
        .await?;
    Ok(())
}

/// Keep only the newest `max` emails per inbox, deleting the rest.
/// Uses NOT IN (SELECT ... ORDER BY DESC LIMIT) to avoid a COUNT subquery.
pub async fn trim_to_limit(db: &D1Database, inbox_id: &str, max: usize) -> Result<()> {
    db.prepare(
        "DELETE FROM mail WHERE inbox_id = ?1 AND id NOT IN (SELECT id FROM mail WHERE inbox_id = ?1 ORDER BY received_at DESC LIMIT ?2)"
    )
        .bind(&[inbox_id.into(), JsValue::from(max as f64)])?
        .run()
        .await?;
    Ok(())
}

/// Fetch email summaries for an inbox, ordered by newest first.
pub async fn find_all(db: &D1Database, inbox_id: &str) -> Result<Vec<MailRow>> {
    let results = db.prepare(
        "SELECT id, from_addr, subject, received_at FROM mail WHERE inbox_id = ?1 ORDER BY received_at DESC"
    )
        .bind(&[inbox_id.into()])?
        .all()
        .await?;
    results.results::<MailRow>()
}

/// Fetch email summaries filtered by exact sender address (case-insensitive).
pub async fn find_by_sender(db: &D1Database, inbox_id: &str, sender: &str) -> Result<Vec<MailRow>> {
    let results = db.prepare(
        "SELECT id, from_addr, subject, received_at FROM mail WHERE inbox_id = ?1 AND LOWER(from_addr) = LOWER(?2) ORDER BY received_at DESC"
    )
        .bind(&[inbox_id.into(), sender.into()])?
        .all()
        .await?;
    results.results::<MailRow>()
}

/// Fetch full email content by ID, scoped to an inbox.
pub async fn find_one(db: &D1Database, inbox_id: &str, mail_id: &str) -> Result<Option<FullMailRow>> {
    db.prepare(
        "SELECT id, inbox_id, from_addr, subject, text_body, html_body, headers, received_at FROM mail WHERE id = ?1 AND inbox_id = ?2"
    )
        .bind(&[mail_id.into(), inbox_id.into()])?
        .first::<FullMailRow>(None)
        .await
}

/// Delete a single email by ID, scoped to an inbox.
pub async fn remove(db: &D1Database, inbox_id: &str, mail_id: &str) -> Result<()> {
    db.prepare("DELETE FROM mail WHERE id = ?1 AND inbox_id = ?2")
        .bind(&[mail_id.into(), inbox_id.into()])?
        .run()
        .await?;
    Ok(())
}

/// Delete all emails in an inbox without removing the inbox itself.
pub async fn remove_all(db: &D1Database, inbox_id: &str) -> Result<()> {
    db.prepare("DELETE FROM mail WHERE inbox_id = ?1")
        .bind(&[inbox_id.into()])?
        .run()
        .await?;
    Ok(())
}

use serde::{Deserialize, Serialize};

// --- D1 Row types ---

#[derive(Deserialize)]
pub struct RegisterCheckRow {
    pub count: i64,
    pub existing: i64,
}

#[derive(Deserialize)]
pub struct InboxTimestamps {
    pub created_at: f64,
    pub expires_at: f64,
}

#[derive(Deserialize)]
pub struct MailRow {
    pub id: String,
    pub from_addr: String,
    pub subject: String,
    pub received_at: f64,
}

#[derive(Deserialize)]
pub struct FullMailRow {
    pub id: String,
    pub inbox_id: String,
    pub from_addr: String,
    pub subject: String,
    pub text_body: String,
    pub html_body: String,
    pub headers: String,
    pub received_at: f64,
}

pub struct MailEntry {
    pub id: String,
    pub from: String,
    pub inbox: String,
    pub subject: String,
    pub text: String,
    pub html: String,
    pub headers: serde_json::Value,
}

// --- API response types (timestamps as Unix seconds) ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailMeta {
    pub id: String,
    pub from: String,
    pub subject: String,
    pub received_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailEntryResponse {
    pub id: String,
    pub from: String,
    pub inbox: String,
    pub subject: String,
    pub text: String,
    pub html: String,
    pub headers: serde_json::Value,
    pub received_at: u64,
}

#[derive(Serialize)]
pub struct InboxResponse {
    pub emails: Vec<MailMeta>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterResponse {
    pub inbox: String,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Reuse RegisterResponse shape for status queries
pub type InboxStatusResponse = RegisterResponse;

#[derive(Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

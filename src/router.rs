use worker::*;
use crate::auth;
use crate::service;
use crate::handlers::{self, json_response};
use crate::types::*;

const INDEX_HTML: &str = include_str!("../frontend/dist/index.html");
const LLMS_TXT: &str = include_str!("llms.txt");

pub async fn handle_request(mut req: Request, env: &Env) -> Result<Response> {
    let path = req.path();
    let method = req.method();

    if path == "/llms.txt" {
        return serve_text(LLMS_TXT);
    }

    if !path.starts_with("/api/") {
        return serve_html();
    }

    if path == "/api/internal/email" && method == Method::Post {
        if !auth::check_internal_secret(&req, env)? {
            return Response::error("Forbidden", 403);
        }
        let to = req.headers().get("X-Email-To")?.unwrap_or_default().to_lowercase();
        let raw = req.bytes().await?;
        return match service::mail::receive_email(&raw, &to, env).await {
            Ok(()) => Response::ok("ok"),
            Err(e) => {
                let msg = e.to_string();
                let status = if msg.contains("not registered") || msg.contains("Malformed") { 400 } else { 500 };
                Response::error(format!("Email processing failed: {}", msg), status)
            }
        };
    }

    if !auth::check_auth(&req, env)? {
        return auth::unauthorized();
    }

    let api_path = &path[4..];
    let segments: Vec<&str> = api_path.split('/').filter(|s| !s.is_empty()).collect();

    match (method, segments.as_slice()) {
        (Method::Get, ["config"])                            => handlers::config::get_config(env).await,
        (Method::Post, ["inbox", inbox])                     => handlers::inbox::register(inbox, env).await,
        (Method::Delete, ["inbox", inbox])                   => handlers::inbox::delete(inbox, env).await,
        (Method::Delete, ["inbox", inbox, "emails"])            => handlers::inbox::clear_emails(inbox, env).await,
        (Method::Get, ["inbox", inbox])                      => handlers::inbox::list(inbox, env).await,
        (Method::Get, ["inbox", inbox, "status"])               => handlers::inbox::status(inbox, env).await,
        (Method::Put, ["inbox", inbox, "renew"])                => handlers::inbox::renew(inbox, env).await,
        (Method::Get, ["inbox", inbox, "from", from])        => handlers::inbox::list_by_from(inbox, from, env).await,
        (Method::Get, ["mail", inbox, id])                   => handlers::mail::get(inbox, id, env).await,
        (Method::Delete, ["mail", inbox, id])                => handlers::mail::delete(inbox, id, env).await,
        _ => json_response(&ErrorResponse { error: "Not found".into() }, 404),
    }
}

fn serve_html() -> Result<Response> {
    let headers = Headers::new();
    headers.set("Content-Type", "text/html; charset=utf-8")?;
    Ok(Response::ok(INDEX_HTML)?.with_headers(headers))
}

fn serve_text(content: &str) -> Result<Response> {
    let headers = Headers::new();
    headers.set("Content-Type", "text/plain; charset=utf-8")?;
    Ok(Response::ok(content)?.with_headers(headers))
}

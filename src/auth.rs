use worker::*;

fn get_token(env: &Env) -> String {
    env.secret("AUTH_TOKEN").map(|s| s.to_string()).unwrap_or_default()
}

pub fn check_auth(req: &Request, env: &Env) -> Result<bool> {
    let token = get_token(env);
    if token.is_empty() {
        return Ok(false);
    }

    let header = match req.headers().get("Authorization")? {
        Some(h) => h,
        None => return Ok(false),
    };

    Ok(header.len() == 7 + token.len()
        && header.starts_with("Bearer ")
        && &header[7..] == token.as_str())
}

pub fn check_internal_secret(req: &Request, env: &Env) -> Result<bool> {
    let secret = req.headers().get("X-Internal-Secret")?.unwrap_or_default();
    let expected = get_token(env);
    Ok(!secret.is_empty() && secret == expected)
}

pub fn unauthorized() -> Result<Response> {
    Response::from_json(&serde_json::json!({"error": "Unauthorized"}))
        .map(|r| r.with_status(401))
}

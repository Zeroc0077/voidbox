use worker::*;

mod auth;
mod handlers;
mod repo;
mod router;
mod service;
mod types;

#[event(fetch, respond_with_errors)]
pub async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    router::handle_request(req, &env).await
}

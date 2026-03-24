pub mod inbox;
pub mod mail;

use worker::wasm_bindgen::JsValue;
use worker::D1Database;

pub fn bind_u64(v: u64) -> JsValue {
    JsValue::from(v as f64)
}

pub fn now_secs() -> u64 {
    (js_sys::Date::now() / 1000.0) as u64
}

pub fn get_db(env: &worker::Env) -> worker::Result<D1Database> {
    env.d1("DB")
}

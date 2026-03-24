// JS entry point: wraps the Rust WASM Worker class and adds email event support.
// workers-rs 0.7 exports a class extending WorkerEntrypoint, not a plain object.
// We instantiate it for fetch, and add email handling that delegates to the same WASM logic.
//
// Security: external HTTP requests go through the fetch export, where X-Internal-Secret
// is stripped. The email export calls instance.fetch() directly (bypasses this fetch export),
// so only genuine email events can carry the internal secret.

import Worker from "../build/worker/shim.mjs";

export default {
  async fetch(request, env, ctx) {
    const headers = new Headers(request.headers);
    headers.delete("X-Internal-Secret");
    const cleaned = new Request(request, { headers });

    const instance = new Worker(ctx, env);
    return instance.fetch(cleaned);
  },

  async email(message, env, ctx) {
    try {
      const rawBody = await new Response(message.raw).arrayBuffer();

      const req = new Request("https://internal/api/internal/email", {
        method: "POST",
        body: rawBody,
        headers: {
          "X-Email-To": message.to,
          "X-Internal-Secret": env.AUTH_TOKEN,
        },
      });

      // Calls WASM directly, does NOT go through the fetch export above
      const instance = new Worker(ctx, env);
      const resp = await instance.fetch(req);
      if (!resp.ok) {
        const body = await resp.text();
        console.error("Email processing failed:", resp.status, body);
      }
    } catch (e) {
      console.error("Email handler error:", e);
    }
  },
};

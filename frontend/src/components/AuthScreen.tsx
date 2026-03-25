import { createSignal } from "solid-js";
import { api } from "../lib/api";
import { setTokenValue, initSession } from "../stores/auth";
import Logo from "./Logo";

export default function AuthScreen() {
  const [inputToken, setInputToken] = createSignal("");
  const [error, setError] = createSignal("");

  async function doAuth() {
    const t = inputToken().trim();
    if (!t) {
      setError("Token required");
      return;
    }
    setError("");
    setTokenValue(t);
    try {
      await initSession();
    } catch {
      setError("Invalid token");
      setTokenValue("");
    }
  }

  return (
    <div class="auth-box">
      <Logo large />
      <p>Enter your access token to continue</p>
      <input
        type="password"
        placeholder="ACCESS TOKEN"
        autocomplete="off"
        value={inputToken()}
        onInput={(e) => setInputToken(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === "Enter") doAuth(); }}
      />
      <button class="btn-primary" onClick={doAuth}>
        Authenticate
      </button>
      {error() && <p class="auth-err">{error()}</p>}
    </div>
  );
}

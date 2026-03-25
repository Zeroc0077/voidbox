import { createSignal } from "solid-js";

const [token, setToken] = createSignal(localStorage.getItem("tk") || "");
const [authenticated, setAuthenticated] = createSignal(false);

export { token, authenticated, setAuthenticated };

export function setTokenValue(t: string) {
  setToken(t);
  if (t) localStorage.setItem("tk", t);
  else localStorage.removeItem("tk");
}

export async function initSession() {
  const { api } = await import("../lib/api");
  const { setMailDomains, setSelectedDomain } = await import("./inbox");
  const cfg = await api<{ mailDomains: string[] }>("GET", "/config");
  const domains = cfg.mailDomains || [];
  setMailDomains(domains);
  if (domains.length > 0) setSelectedDomain(domains[0]);
  setAuthenticated(true);
}

export function logout() {
  setTokenValue("");
  setAuthenticated(false);
  localStorage.clear();
}

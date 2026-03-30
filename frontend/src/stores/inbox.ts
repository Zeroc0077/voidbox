import { createSignal, batch } from "solid-js";
import { api } from "../lib/api";
import { showToast } from "./toast";

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  receivedAt: number;
}

const [currentInbox, setCurrentInbox] = createSignal(localStorage.getItem("inbox") || "");
const [expiresAt, setExpiresAt] = createSignal(
  parseInt(localStorage.getItem("inbox_exp") || "0")
);
const [mailDomains, setMailDomains] = createSignal<string[]>([]);
const [selectedDomain, setSelectedDomain] = createSignal("");
const [emails, setEmails] = createSignal<EmailSummary[]>([]);
const [filterFrom, setFilterFrom] = createSignal("");
const [relayEnabled, setRelayEnabled] = createSignal(false);
const [relayDomains, setRelayDomains] = createSignal<string[]>([]);
const [relayInboxes, setRelayInboxes] = createSignal<string[]>([]);

export {
  currentInbox, expiresAt, mailDomains, selectedDomain,
  emails, filterFrom, relayEnabled, relayDomains, relayInboxes,
  setMailDomains, setSelectedDomain, setFilterFrom,
  setRelayEnabled, setRelayDomains, setRelayInboxes,
};

function persistInbox(inbox: string, exp: number) {
  setCurrentInbox(inbox);
  setExpiresAt(exp);
  if (inbox) {
    localStorage.setItem("inbox", inbox);
    localStorage.setItem("inbox_exp", String(exp));
  } else {
    localStorage.removeItem("inbox");
    localStorage.removeItem("inbox_exp");
  }
}

export async function register(prefix: string, domain: string) {
  const inbox = prefix.trim().toLowerCase() + (domain ? "@" + domain : "");
  if (!prefix.trim()) { showToast("Enter a prefix", "error"); return; }
  if (!domain) { showToast("Select a domain", "error"); return; }
  try {
    const res = await api<{ expiresAt: number }>("POST", "/inbox/" + encodeURIComponent(inbox));
    persistInbox(inbox, res.expiresAt);
    showToast("Inbox registered");
    await Promise.all([refreshStatus(), refreshEmails()]);
  } catch (e: any) {
    if (e.message.includes("already registered")) {
      persistInbox(inbox, Math.floor(Date.now() / 1000) + 3600);
      showToast("Switched to existing inbox");
      await Promise.all([refreshStatus(), refreshEmails()]);
    } else {
      showToast(e.message, "error");
    }
  }
}

export async function registerRelay(address: string) {
  const inbox = address.trim().toLowerCase();
  if (!inbox || !inbox.includes("@")) { showToast("Enter a valid email address", "error"); return; }
  const domain = inbox.split("@")[1];
  if (!relayDomains().includes(domain)) { showToast("Domain not in relay domains", "error"); return; }
  try {
    const res = await api<{ expiresAt: number }>("POST", "/inbox/" + encodeURIComponent(inbox));
    persistInbox(inbox, res.expiresAt);
    showToast("Relay inbox registered");
    await Promise.all([refreshStatus(), refreshEmails()]);
  } catch (e: any) {
    if (e.message.includes("already registered")) {
      persistInbox(inbox, Math.floor(Date.now() / 1000) + 3600);
      showToast("Switched to existing inbox");
      await Promise.all([refreshStatus(), refreshEmails()]);
    } else {
      showToast(e.message, "error");
    }
  }
}

export async function refreshStatus() {
  const inbox = currentInbox();
  if (!inbox) return;
  try {
    const s = await api<{ expiresAt: number }>("GET", "/inbox/" + encodeURIComponent(inbox) + "/status");
    persistInbox(inbox, s.expiresAt);
  } catch {
    // Inbox may have expired server-side
  }
}

export async function refreshEmails() {
  const inbox = currentInbox();
  if (!inbox) return;
  try {
    const ff = filterFrom().trim();
    let path = "/inbox/" + encodeURIComponent(inbox);
    if (ff) path += "/from/" + encodeURIComponent(ff);
    const data = await api<{ emails: EmailSummary[] }>("GET", path);
    setEmails(data.emails || []);
  } catch {
    showToast("Refresh failed", "error");
  }
}

export async function renewInbox() {
  const inbox = currentInbox();
  if (!inbox) return;
  try {
    const s = await api<{ expiresAt: number }>("PUT", "/inbox/" + encodeURIComponent(inbox) + "/renew");
    persistInbox(inbox, s.expiresAt);
    showToast("Extended 1 hour");
  } catch (e: any) {
    showToast(e.message, "error");
  }
}

function resetInboxState() {
  batch(() => {
    persistInbox("", 0);
    setEmails([]);
    setFilterFrom("");
  });
}

export async function deleteInbox() {
  const inbox = currentInbox();
  if (!inbox || !confirm("Delete inbox " + inbox + "?")) return;
  try {
    await api<any>("DELETE", "/inbox/" + encodeURIComponent(inbox));
  } catch {}
  resetInboxState();
  showToast("Inbox deleted");
}

export async function clearEmails() {
  const inbox = currentInbox();
  if (!inbox || !confirm("Clear all emails in " + inbox + "?")) return;
  try {
    await api<any>("DELETE", "/inbox/" + encodeURIComponent(inbox) + "/emails");
    await refreshEmails();
    showToast("All emails cleared");
  } catch (e: any) {
    showToast(e.message, "error");
  }
}

export function expireInbox() {
  resetInboxState();
  showToast("Inbox expired", "error");
}

export function switchInbox() {
  resetInboxState();
  showToast("Inbox switched");
}

export function copyAddress() {
  navigator.clipboard
    .writeText(currentInbox())
    .then(() => showToast("Copied to clipboard"))
    .catch(() => showToast("Copy failed", "error"));
}

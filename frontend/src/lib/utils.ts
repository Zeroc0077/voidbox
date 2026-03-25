export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function timeAgo(ts: number): string {
  if (!ts) return "";
  const d = Date.now() - ts * 1000;
  if (d < 60000) return "just now";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  return Math.floor(d / 3600000) + "h ago";
}

export function formatDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString();
}

const AVATAR_COLORS = [
  "#d4a53c", "#3ca36a", "#c44040", "#4a8fd4",
  "#9b59b6", "#e67e22", "#1abc9c", "#e74c3c",
];

export function avatarColor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function avatarInitial(email: string): string {
  const name = email.split("@")[0] || "?";
  return name.charAt(0).toUpperCase();
}

export function formatHeaders(headers: Record<string, string> | null | undefined): string {
  if (!headers || typeof headers !== "object") return "";
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

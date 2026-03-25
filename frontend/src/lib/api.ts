import { token } from "../stores/auth";

export async function api<T>(method: string, path: string): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token(),
      "Content-Type": "application/json",
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as any).error || r.statusText);
  return j as T;
}

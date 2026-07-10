import type { ApiErrorPayload } from "../types/api";

export async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  let token = "";
  let role = "";
  let userId = "";
  if (typeof window !== "undefined") {
    token = localStorage.getItem("scm-demo-token") || "";
    try {
      const user = JSON.parse(localStorage.getItem("scm-demo-user") || "{}");
      const rawRole = String(user.role || "").toLowerCase();
      role = /admin|管理员/.test(rawRole) ? "admin" : /manager|经理|approver/.test(rawRole) ? "manager" : /viewer|只读/.test(rawRole) ? "viewer" : "analyst";
      userId = String(user.id || "");
    } catch { /* Ignore malformed local session metadata. */ }
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(role ? { "X-FlowChain-Role": role } : {}),
      ...(userId ? { "X-FlowChain-User": userId } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const payload = JSON.parse(text) as ApiErrorPayload;
      message = payload.message || payload.error || message;
    } catch {
      // Some local development endpoints may return plain text.
    }
    throw new Error(message || `API request failed: ${res.status}`);
  }

  return res.json();
}

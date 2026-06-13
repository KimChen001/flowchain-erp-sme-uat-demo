import type { ApiErrorPayload } from "../types/api";

export async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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

import type { components } from "./schema";

export type Health = components["schemas"]["Health"];
export type Status = components["schemas"]["Status"];
export type ProviderStatus = components["schemas"]["ProviderStatus"];
export type FunctionsConfig = components["schemas"]["FunctionsConfig"];
export type LayoutOut = components["schemas"]["LayoutOut"];
export type FormFactor = "desktop" | "tablet";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  // /health answers 503 with a full body when degraded; callers still want it.
  if (!res.ok && !(path.endsWith("/health") && body)) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? res.statusText);
  }
  return body as T;
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>("/api/health"),
  status: () => request<Status>("/api/status"),
  functions: () => request<FunctionsConfig>("/api/functions"),
  getWorkspace: (name: string, ff: FormFactor) =>
    request<LayoutOut>(`/api/workspaces/${enc(name)}?form_factor=${ff}`),
  saveWorkspace: (name: string, ff: FormFactor, layout: Record<string, unknown>) =>
    request<LayoutOut>(`/api/workspaces/${enc(name)}?form_factor=${ff}`, {
      method: "PUT",
      body: JSON.stringify({ layout }),
    }),
  addHistory: (command: string) =>
    request<unknown>("/api/history", { method: "POST", body: JSON.stringify({ command }) }),
};

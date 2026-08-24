import type { BuildResponse, CadDocument, ProviderStatus } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  document: () => request<BuildResponse>("/api/document"),
  updateDocument: (document: CadDocument) =>
    request<BuildResponse>("/api/document", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document),
    }),
  generate: (prompt: string, model: string) =>
    request<BuildResponse>("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, provider: "openai", model }),
    }),
  providerStatus: () => request<ProviderStatus>("/api/settings/providers/openai"),
  saveApiKey: (apiKey: string) =>
    request<ProviderStatus>("/api/settings/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", api_key: apiKey }),
    }),
  importModel: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<BuildResponse>("/api/import", { method: "POST", body });
  },
  undo: () => request<BuildResponse>("/api/history/undo", { method: "POST" }),
  redo: () => request<BuildResponse>("/api/history/redo", { method: "POST" }),
};

import type {
  BuildResponse,
  CadDocument,
  HierarchyResponse,
  ObjectRef,
  ProviderStatus,
} from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function named(method: "POST" | "PUT", name: string): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  };
}

function objectBase(ref: ObjectRef): string {
  return `/api/workspaces/${ref.workspaceId}/projects/${ref.projectId}/objects/${ref.objectId}`;
}

export const api = {
  hierarchy: () => request<HierarchyResponse>("/api/workspaces"),
  createWorkspace: (name: string) =>
    request<HierarchyResponse>("/api/workspaces", named("POST", name)),
  renameWorkspace: (workspaceId: string, name: string) =>
    request<HierarchyResponse>(`/api/workspaces/${workspaceId}`, named("PUT", name)),
  deleteWorkspace: (workspaceId: string) =>
    request<HierarchyResponse>(`/api/workspaces/${workspaceId}`, { method: "DELETE" }),
  createProject: (workspaceId: string, name: string) =>
    request<HierarchyResponse>(
      `/api/workspaces/${workspaceId}/projects`,
      named("POST", name),
    ),
  renameProject: (workspaceId: string, projectId: string, name: string) =>
    request<HierarchyResponse>(
      `/api/workspaces/${workspaceId}/projects/${projectId}`,
      named("PUT", name),
    ),
  deleteProject: (workspaceId: string, projectId: string) =>
    request<HierarchyResponse>(`/api/workspaces/${workspaceId}/projects/${projectId}`, {
      method: "DELETE",
    }),
  createObject: (workspaceId: string, projectId: string, name: string) =>
    request<HierarchyResponse>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/objects`,
      named("POST", name),
    ),
  renameObject: (ref: ObjectRef, name: string) =>
    request<HierarchyResponse>(objectBase(ref), named("PUT", name)),
  deleteObject: (ref: ObjectRef) =>
    request<HierarchyResponse>(objectBase(ref), { method: "DELETE" }),
  document: (ref: ObjectRef) => request<BuildResponse>(`${objectBase(ref)}/document`),
  updateDocument: (ref: ObjectRef, document: CadDocument) =>
    request<BuildResponse>(`${objectBase(ref)}/document`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document),
    }),
  generate: (ref: ObjectRef, prompt: string, model: string) =>
    request<BuildResponse>(`${objectBase(ref)}/generate`, {
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
  importModel: async (ref: ObjectRef, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<BuildResponse>(`${objectBase(ref)}/import`, { method: "POST", body });
  },
  undo: (ref: ObjectRef) =>
    request<BuildResponse>(`${objectBase(ref)}/history/undo`, { method: "POST" }),
  redo: (ref: ObjectRef) =>
    request<BuildResponse>(`${objectBase(ref)}/history/redo`, { method: "POST" }),
  previewUrl: (ref: ObjectRef, revision: number) =>
    `${objectBase(ref)}/preview.stl?revision=${revision}`,
  exportUrl: (ref: ObjectRef, extension: "step" | "stl") =>
    `${objectBase(ref)}/export/${extension}`,
};

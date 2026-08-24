import type {
  AgentApplyResponse,
  AgentConversation,
  AgentStreamEvent,
  BuildResponse,
  CadDocument,
  CommunityCatalogResponse,
  CommunityListingDraft,
  ExtensionCatalogResponse,
  HierarchyResponse,
  ObjectRef,
  ProviderStatus,
  ScanCatalogResponse,
  ScanCopyResponse,
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
  agentConversation: (ref: ObjectRef) =>
    request<AgentConversation>(`${objectBase(ref)}/agent`),
  streamAgentMessage: async (
    ref: ObjectRef,
    prompt: string,
    model: string,
    onEvent: (event: AgentStreamEvent) => void,
  ) => {
    const response = await fetch(`${objectBase(ref)}/agent/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, provider: "openai", model }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(payload?.detail ?? `Request failed (${response.status})`);
    }
    if (!response.body) throw new Error("Streaming is unavailable in this browser");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (!frame || frame.startsWith(":")) continue;
        const event = frame.match(/^event: (.+)$/m)?.[1];
        const data = frame.match(/^data: (.+)$/m)?.[1];
        if (event && data) onEvent({ event, data: JSON.parse(data) } as AgentStreamEvent);
      }
      if (done) break;
    }
  },
  applyAgentProposal: (ref: ObjectRef) =>
    request<AgentApplyResponse>(`${objectBase(ref)}/agent/proposal/apply`, {
      method: "POST",
    }),
  discardAgentProposal: (ref: ObjectRef) =>
    request<AgentConversation>(`${objectBase(ref)}/agent/proposal/discard`, {
      method: "POST",
    }),
  providerStatus: () => request<ProviderStatus>("/api/settings/providers/openai"),
  saveApiKey: (apiKey: string) =>
    request<ProviderStatus>("/api/settings/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", api_key: apiKey }),
    }),
  extensions: () => request<ExtensionCatalogResponse>("/api/extensions"),
  installExtension: (extensionId: string) =>
    request<ExtensionCatalogResponse>(`/api/extensions/${extensionId}/install`, {
      method: "POST",
    }),
  uninstallExtension: (extensionId: string) =>
    request<ExtensionCatalogResponse>(`/api/extensions/${extensionId}`, {
      method: "DELETE",
    }),
  enableExtension: (extensionId: string, enabled: boolean) =>
    request<ExtensionCatalogResponse>(`/api/extensions/${extensionId}/enabled`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
  connectTrellis: (endpoint: string, apiToken: string) =>
    request<ExtensionCatalogResponse>("/api/extensions/marul.trellis/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, api_token: apiToken }),
    }),
  disconnectTrellis: () =>
    request<ExtensionCatalogResponse>("/api/extensions/marul.trellis/disconnect", {
      method: "POST",
    }),
  community: () => request<CommunityCatalogResponse>("/api/community/listings"),
  createCommunityDraft: (ref: ObjectRef, draft: CommunityListingDraft) =>
    request<CommunityCatalogResponse>("/api/community/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        workspace_id: ref.workspaceId,
        project_id: ref.projectId,
        object_id: ref.objectId,
      }),
    }),
  deleteCommunityDraft: (listingId: string) =>
    request<CommunityCatalogResponse>(`/api/community/listings/${listingId}`, {
      method: "DELETE",
    }),
  scans: () => request<ScanCatalogResponse>("/api/scans"),
  copyScan: (scanId: string, workspaceId: string, projectId: string, objectName: string) =>
    request<ScanCopyResponse>(`/api/scans/${scanId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        project_id: projectId,
        object_name: objectName,
      }),
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

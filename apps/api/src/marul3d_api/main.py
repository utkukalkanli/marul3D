from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path

from fastapi import Body, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from marul3d_api import __version__
from marul3d_api.agent_service import AgentService
from marul3d_api.build_engine import BuildError
from marul3d_api.community_store import CommunityError, CommunityStore
from marul3d_api.credentials import CredentialStore
from marul3d_api.extension_store import ExtensionError, ExtensionStore
from marul3d_api.hierarchy_store import HierarchyError, WorkspaceStore
from marul3d_api.models import (
    AgentApplyResponse,
    AgentConversation,
    AgentPromptRequest,
    BuildResponse,
    CadDocument,
    CommunityCatalogResponse,
    CommunityListingCreateRequest,
    CredentialRequest,
    EntityNameRequest,
    ExtensionCatalogResponse,
    ExtensionEnableRequest,
    GenerateRequest,
    HierarchyResponse,
    ProviderStatus,
    ScanCatalogResponse,
    ScanCopyRequest,
    ScanCopyResponse,
    TrellisConnectionRequest,
)
from marul3d_api.project_store import ProjectStore
from marul3d_api.providers import OpenAIProvider
from marul3d_api.scan_store import ScanError, ScanStore

app = FastAPI(
    title="marul3D local API",
    version=__version__,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


@lru_cache(maxsize=1)
def get_store() -> WorkspaceStore:
    return WorkspaceStore()


@lru_cache(maxsize=1)
def get_credentials() -> CredentialStore:
    return CredentialStore()


@lru_cache(maxsize=1)
def get_agent_service() -> AgentService:
    return AgentService()


@lru_cache(maxsize=1)
def get_extension_store() -> ExtensionStore:
    return ExtensionStore()


@lru_cache(maxsize=1)
def get_community_store() -> CommunityStore:
    return CommunityStore()


@lru_cache(maxsize=1)
def get_scan_store() -> ScanStore:
    return ScanStore()


def _build_response(document: CadDocument, summary: str | None = None) -> BuildResponse:
    return BuildResponse(
        document=document,
        preview_revision=document.revision,
        summary=summary,
    )


def _object_store(
    store: WorkspaceStore,
    workspace_id: str,
    project_id: str,
    object_id: str,
) -> ProjectStore:
    try:
        return store.object_store(workspace_id, project_id, object_id)
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/api/workspaces", response_model=HierarchyResponse)
def hierarchy(store: WorkspaceStore = Depends(get_store)) -> HierarchyResponse:
    return store.hierarchy()


@app.post("/api/workspaces", response_model=HierarchyResponse)
def create_workspace(
    request: EntityNameRequest,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    return store.create_workspace(request.name.strip())


@app.put("/api/workspaces/{workspace_id}", response_model=HierarchyResponse)
def rename_workspace(
    workspace_id: str,
    request: EntityNameRequest,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.rename_workspace(workspace_id, request.name.strip())
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/workspaces/{workspace_id}", response_model=HierarchyResponse)
def delete_workspace(
    workspace_id: str,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.delete_workspace(workspace_id)
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/workspaces/{workspace_id}/projects", response_model=HierarchyResponse)
def create_project(
    workspace_id: str,
    request: EntityNameRequest,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.create_project(workspace_id, request.name.strip())
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.put(
    "/api/workspaces/{workspace_id}/projects/{project_id}",
    response_model=HierarchyResponse,
)
def rename_project(
    workspace_id: str,
    project_id: str,
    request: EntityNameRequest,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.rename_project(workspace_id, project_id, request.name.strip())
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete(
    "/api/workspaces/{workspace_id}/projects/{project_id}",
    response_model=HierarchyResponse,
)
def delete_project(
    workspace_id: str,
    project_id: str,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.delete_project(workspace_id, project_id)
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post(
    "/api/workspaces/{workspace_id}/projects/{project_id}/objects",
    response_model=HierarchyResponse,
)
def create_object(
    workspace_id: str,
    project_id: str,
    request: EntityNameRequest,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.create_object(workspace_id, project_id, request.name.strip())
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.put(
    "/api/workspaces/{workspace_id}/projects/{project_id}/objects/{object_id}",
    response_model=HierarchyResponse,
)
def rename_object(
    workspace_id: str,
    project_id: str,
    object_id: str,
    request: EntityNameRequest,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.rename_object(workspace_id, project_id, object_id, request.name.strip())
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete(
    "/api/workspaces/{workspace_id}/projects/{project_id}/objects/{object_id}",
    response_model=HierarchyResponse,
)
def delete_object(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
) -> HierarchyResponse:
    try:
        return store.delete_object(workspace_id, project_id, object_id)
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


OBJECT_PATH = "/api/workspaces/{workspace_id}/projects/{project_id}/objects/{object_id}"


@app.get(f"{OBJECT_PATH}/document", response_model=BuildResponse)
def read_document(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
) -> BuildResponse:
    return _build_response(_object_store(store, workspace_id, project_id, object_id).document())


@app.put(f"{OBJECT_PATH}/document", response_model=BuildResponse)
def update_document(
    workspace_id: str,
    project_id: str,
    object_id: str,
    document: CadDocument,
    store: WorkspaceStore = Depends(get_store),
) -> BuildResponse:
    object_store = _object_store(store, workspace_id, project_id, object_id)
    try:
        return _build_response(object_store.apply(document))
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get(f"{OBJECT_PATH}/preview.stl", response_class=FileResponse)
def preview(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
) -> FileResponse:
    object_store = _object_store(store, workspace_id, project_id, object_id)
    return FileResponse(
        object_store.preview_path,
        media_type="model/stl",
        filename="marul3d-preview.stl",
        headers={"Cache-Control": "no-store"},
    )


@app.post(f"{OBJECT_PATH}/generate", response_model=BuildResponse)
def generate(
    workspace_id: str,
    project_id: str,
    object_id: str,
    request: GenerateRequest,
    store: WorkspaceStore = Depends(get_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> BuildResponse:
    api_key, _ = credentials.get(request.provider)
    if not api_key:
        raise HTTPException(status_code=409, detail="Add an OpenAI API key in Settings first")
    object_store = _object_store(store, workspace_id, project_id, object_id)
    try:
        provider = OpenAIProvider(api_key)
        proposal = provider.propose(request.prompt, object_store.document(), request.model)
        return _build_response(object_store.apply(proposal.document), proposal.summary)
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get(f"{OBJECT_PATH}/agent", response_model=AgentConversation)
def agent_conversation(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
    service: AgentService = Depends(get_agent_service),
) -> AgentConversation:
    return service.conversation(_object_store(store, workspace_id, project_id, object_id))


@app.post(f"{OBJECT_PATH}/agent/messages")
def agent_message(
    workspace_id: str,
    project_id: str,
    object_id: str,
    request: AgentPromptRequest,
    store: WorkspaceStore = Depends(get_store),
    credentials: CredentialStore = Depends(get_credentials),
    service: AgentService = Depends(get_agent_service),
) -> StreamingResponse:
    api_key, _ = credentials.get(request.provider)
    if not api_key:
        raise HTTPException(status_code=409, detail="Add an OpenAI API key in Settings first")
    project = _object_store(store, workspace_id, project_id, object_id)
    return StreamingResponse(
        service.stream(project, request.prompt, request.model, api_key),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post(f"{OBJECT_PATH}/agent/proposal/apply", response_model=AgentApplyResponse)
def apply_agent_proposal(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
    service: AgentService = Depends(get_agent_service),
) -> AgentApplyResponse:
    project = _object_store(store, workspace_id, project_id, object_id)
    try:
        document, conversation = service.apply(project)
    except (BuildError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return AgentApplyResponse(
        build=_build_response(document, "Agent changes applied"), conversation=conversation
    )


@app.post(f"{OBJECT_PATH}/agent/proposal/discard", response_model=AgentConversation)
def discard_agent_proposal(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
    service: AgentService = Depends(get_agent_service),
) -> AgentConversation:
    project = _object_store(store, workspace_id, project_id, object_id)
    return service.discard(project)


@app.post("/api/internal/agent/{operation_id}/tools/{tool_name}")
def invoke_agent_tool(
    operation_id: str,
    tool_name: str,
    payload: dict[str, object] = Body(default_factory=dict),
    x_marul_agent_token: str = Header(default=""),
    service: AgentService = Depends(get_agent_service),
) -> dict[str, object]:
    if not x_marul_agent_token or not secrets.compare_digest(
        x_marul_agent_token, service.internal_token
    ):
        raise HTTPException(status_code=403, detail="Invalid agent tool token")
    try:
        return service.tools.execute(operation_id, tool_name, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (BuildError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post(f"{OBJECT_PATH}/import", response_model=BuildResponse)
async def import_model(
    workspace_id: str,
    project_id: str,
    object_id: str,
    file: UploadFile = File(...),
    store: WorkspaceStore = Depends(get_store),
) -> BuildResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The selected file is empty")
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imports are limited to 100 MB")
    object_store = _object_store(store, workspace_id, project_id, object_id)
    try:
        document = object_store.import_file(file.filename or "model.step", content)
        return _build_response(document, f"Imported {Path(file.filename or 'model').name}")
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post(f"{OBJECT_PATH}/history/undo", response_model=BuildResponse)
def undo(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
) -> BuildResponse:
    try:
        return _build_response(_object_store(store, workspace_id, project_id, object_id).undo())
    except BuildError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post(f"{OBJECT_PATH}/history/redo", response_model=BuildResponse)
def redo(
    workspace_id: str,
    project_id: str,
    object_id: str,
    store: WorkspaceStore = Depends(get_store),
) -> BuildResponse:
    try:
        return _build_response(_object_store(store, workspace_id, project_id, object_id).redo())
    except BuildError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get(f"{OBJECT_PATH}/export/{{extension}}", response_class=FileResponse)
def export_model(
    workspace_id: str,
    project_id: str,
    object_id: str,
    extension: str,
    store: WorkspaceStore = Depends(get_store),
) -> FileResponse:
    try:
        path = _object_store(store, workspace_id, project_id, object_id).export(extension.lower())
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    media_type = "model/stl" if extension.lower() == "stl" else "model/step"
    return FileResponse(path, media_type=media_type, filename=path.name)


@app.get("/api/settings/providers/openai", response_model=ProviderStatus)
def provider_status(
    credentials: CredentialStore = Depends(get_credentials),
) -> ProviderStatus:
    value, storage = credentials.get("openai")
    return ProviderStatus(
        provider="openai",
        configured=bool(value),
        storage=storage,
    )


@app.post("/api/settings/api-key", response_model=ProviderStatus)
def save_api_key(
    request: CredentialRequest,
    credentials: CredentialStore = Depends(get_credentials),
) -> ProviderStatus:
    try:
        credentials.set(request.provider, request.api_key)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ProviderStatus(provider=request.provider, configured=True, storage="keychain")


@app.get("/api/community/listings", response_model=CommunityCatalogResponse)
def community_catalog(
    community: CommunityStore = Depends(get_community_store),
) -> CommunityCatalogResponse:
    return community.catalog()


@app.post("/api/community/listings", response_model=CommunityCatalogResponse)
def create_community_listing(
    request: CommunityListingCreateRequest,
    store: WorkspaceStore = Depends(get_store),
    community: CommunityStore = Depends(get_community_store),
) -> CommunityCatalogResponse:
    object_store = _object_store(
        store,
        request.workspace_id,
        request.project_id,
        request.object_id,
    )
    return community.create_draft(request, object_store.document().name)


@app.delete(
    "/api/community/listings/{listing_id}", response_model=CommunityCatalogResponse
)
def delete_community_listing(
    listing_id: str,
    community: CommunityStore = Depends(get_community_store),
) -> CommunityCatalogResponse:
    try:
        return community.delete_draft(listing_id)
    except CommunityError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/scans", response_model=ScanCatalogResponse)
def scan_catalog(scans: ScanStore = Depends(get_scan_store)) -> ScanCatalogResponse:
    return scans.catalog()


@app.post("/api/scans/{scan_id}/copy", response_model=ScanCopyResponse)
def copy_scan_to_project(
    scan_id: str,
    request: ScanCopyRequest,
    store: WorkspaceStore = Depends(get_store),
    scans: ScanStore = Depends(get_scan_store),
) -> ScanCopyResponse:
    try:
        asset = scans.asset(scan_id)
        content = scans.stl_bytes(scan_id)
    except ScanError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    try:
        hierarchy = store.create_object(
            request.workspace_id,
            request.project_id,
            request.object_name.strip(),
        )
        object_id = hierarchy.selected_object_id
        if object_id is None:
            raise HierarchyError("Could not create the scan object")
        target = store.object_store(request.workspace_id, request.project_id, object_id)
        target.import_file(f"{asset.id}.stl", content)
        target.rename(request.object_name.strip())
        return ScanCopyResponse(
            hierarchy=store.hierarchy(request.workspace_id, request.project_id, object_id),
            object_id=object_id,
        )
    except HierarchyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/extensions", response_model=ExtensionCatalogResponse)
def extension_catalog(
    extensions: ExtensionStore = Depends(get_extension_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> ExtensionCatalogResponse:
    return extensions.catalog(credentials)


@app.post("/api/extensions/{extension_id}/install", response_model=ExtensionCatalogResponse)
def install_extension(
    extension_id: str,
    extensions: ExtensionStore = Depends(get_extension_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> ExtensionCatalogResponse:
    try:
        return extensions.install(extension_id, credentials)
    except ExtensionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/extensions/{extension_id}", response_model=ExtensionCatalogResponse)
def uninstall_extension(
    extension_id: str,
    extensions: ExtensionStore = Depends(get_extension_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> ExtensionCatalogResponse:
    try:
        return extensions.uninstall(extension_id, credentials)
    except (ExtensionError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.put("/api/extensions/{extension_id}/enabled", response_model=ExtensionCatalogResponse)
def enable_extension(
    extension_id: str,
    request: ExtensionEnableRequest,
    extensions: ExtensionStore = Depends(get_extension_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> ExtensionCatalogResponse:
    try:
        return extensions.enable(extension_id, request.enabled, credentials)
    except ExtensionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/extensions/marul.trellis/connect", response_model=ExtensionCatalogResponse)
def connect_trellis(
    request: TrellisConnectionRequest,
    extensions: ExtensionStore = Depends(get_extension_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> ExtensionCatalogResponse:
    try:
        return extensions.connect_trellis(request.endpoint, request.api_token, credentials)
    except (ExtensionError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/extensions/marul.trellis/disconnect", response_model=ExtensionCatalogResponse)
def disconnect_trellis(
    extensions: ExtensionStore = Depends(get_extension_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> ExtensionCatalogResponse:
    try:
        return extensions.disconnect_trellis(credentials)
    except (ExtensionError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

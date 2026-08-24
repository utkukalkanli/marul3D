from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from marul3d_api import __version__
from marul3d_api.build_engine import BuildError
from marul3d_api.credentials import CredentialStore
from marul3d_api.hierarchy_store import HierarchyError, WorkspaceStore
from marul3d_api.models import (
    BuildResponse,
    CadDocument,
    CredentialRequest,
    EntityNameRequest,
    GenerateRequest,
    HierarchyResponse,
    ProviderStatus,
)
from marul3d_api.project_store import ProjectStore
from marul3d_api.providers import OpenAIProvider

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
        path = _object_store(store, workspace_id, project_id, object_id).export(
            extension.lower()
        )
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

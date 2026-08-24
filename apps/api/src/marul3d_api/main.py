from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from marul3d_api import __version__
from marul3d_api.build_engine import BuildError
from marul3d_api.credentials import CredentialStore
from marul3d_api.models import (
    BuildResponse,
    CadDocument,
    CredentialRequest,
    GenerateRequest,
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
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type"],
)


@lru_cache(maxsize=1)
def get_store() -> ProjectStore:
    return ProjectStore()


@lru_cache(maxsize=1)
def get_credentials() -> CredentialStore:
    return CredentialStore()


def _build_response(document: CadDocument, summary: str | None = None) -> BuildResponse:
    return BuildResponse(
        document=document,
        preview_revision=document.revision,
        summary=summary,
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/api/document", response_model=BuildResponse)
def read_document(store: ProjectStore = Depends(get_store)) -> BuildResponse:
    return _build_response(store.document())


@app.put("/api/document", response_model=BuildResponse)
def update_document(
    document: CadDocument,
    store: ProjectStore = Depends(get_store),
) -> BuildResponse:
    try:
        return _build_response(store.apply(document))
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/preview.stl", response_class=FileResponse)
def preview(store: ProjectStore = Depends(get_store)) -> FileResponse:
    return FileResponse(
        store.preview_path,
        media_type="model/stl",
        filename="marul3d-preview.stl",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/generate", response_model=BuildResponse)
def generate(
    request: GenerateRequest,
    store: ProjectStore = Depends(get_store),
    credentials: CredentialStore = Depends(get_credentials),
) -> BuildResponse:
    api_key, _ = credentials.get(request.provider)
    if not api_key:
        raise HTTPException(status_code=409, detail="Add an OpenAI API key in Settings first")
    try:
        provider = OpenAIProvider(api_key)
        proposal = provider.propose(request.prompt, store.document(), request.model)
        return _build_response(store.apply(proposal.document), proposal.summary)
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


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


@app.post("/api/import", response_model=BuildResponse)
async def import_model(
    file: UploadFile = File(...),
    store: ProjectStore = Depends(get_store),
) -> BuildResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The selected file is empty")
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imports are limited to 100 MB")
    try:
        document = store.import_file(file.filename or "model.step", content)
        return _build_response(document, f"Imported {Path(file.filename or 'model').name}")
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/history/undo", response_model=BuildResponse)
def undo(store: ProjectStore = Depends(get_store)) -> BuildResponse:
    try:
        return _build_response(store.undo())
    except BuildError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/history/redo", response_model=BuildResponse)
def redo(store: ProjectStore = Depends(get_store)) -> BuildResponse:
    try:
        return _build_response(store.redo())
    except BuildError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/export/{extension}", response_class=FileResponse)
def export_model(
    extension: str,
    store: ProjectStore = Depends(get_store),
) -> FileResponse:
    try:
        path = store.export(extension.lower())
    except BuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    media_type = "model/stl" if extension.lower() == "stl" else "model/step"
    return FileResponse(path, media_type=media_type, filename=path.name)

from __future__ import annotations

import os
import threading
from collections.abc import Callable
from pathlib import Path

import httpx
from platformdirs import user_data_path
from pydantic import BaseModel, Field

from marul3d_api.credentials import CredentialStore
from marul3d_api.models import (
    ExtensionCatalogResponse,
    ExtensionPermission,
    MarketplaceExtension,
)

TRELLIS_ID = "marul.trellis"
TRELLIS_CREDENTIAL = "extension.marul.trellis"


class ExtensionError(RuntimeError):
    pass


class _InstalledExtension(BaseModel):
    installed: bool = False
    enabled: bool = False
    endpoint: str | None = None


class _ExtensionState(BaseModel):
    schema_version: int = 1
    extensions: dict[str, _InstalledExtension] = Field(default_factory=dict)


TRELLIS_MANIFEST = MarketplaceExtension(
    id=TRELLIS_ID,
    name="TRELLIS.2",
    publisher="marul3D",
    description=(
        "Generate high-fidelity textured 3D mesh references from images with a "
        "TRELLIS-compatible remote GPU worker."
    ),
    version="0.1.0",
    category="AI Modeling",
    tags=["Image to 3D", "Mesh", "PBR", "Generative AI"],
    capabilities=["Image-to-3D generation", "GLB mesh output", "Agent tool contribution"],
    permissions=[
        ExtensionPermission(
            id="network:configured-endpoint",
            label="Remote worker access",
            description="Send selected input images to the endpoint you configure.",
        ),
        ExtensionPermission(
            id="object:write-reference",
            label="Create mesh references",
            description="Store generated GLB assets inside the active local CAD object.",
        ),
        ExtensionPermission(
            id="agent:contribute-tool",
            label="Agent tool",
            description="Contribute a constrained TRELLIS generation tool to Marul Agent.",
        ),
    ],
    featured=True,
    verified=True,
)


class ExtensionStore:
    def __init__(
        self,
        root: Path | None = None,
        verify_connection: Callable[[str, str], None] | None = None,
    ) -> None:
        configured = os.getenv("MARUL3D_DATA_DIR")
        self.root = root or (Path(configured) if configured else user_data_path("marul3D"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "extensions.json"
        self._lock = threading.RLock()
        self._state = self._load()
        self._verify_connection = verify_connection or self._verify_remote_worker

    def _load(self) -> _ExtensionState:
        if not self.path.exists():
            return _ExtensionState()
        try:
            return _ExtensionState.model_validate_json(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return _ExtensionState()

    def _write(self) -> None:
        temporary = self.path.with_suffix(".json.tmp")
        temporary.write_text(self._state.model_dump_json(indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def catalog(self, credentials: CredentialStore) -> ExtensionCatalogResponse:
        with self._lock:
            state = self._state.extensions.get(TRELLIS_ID, _InstalledExtension())
            token, _ = credentials.get(TRELLIS_CREDENTIAL)
            extension = TRELLIS_MANIFEST.model_copy(
                update={
                    "installed": state.installed,
                    "enabled": state.enabled,
                    "authenticated": bool(state.installed and token and state.endpoint),
                    "endpoint": state.endpoint,
                },
                deep=True,
            )
            return ExtensionCatalogResponse(extensions=[extension])

    def install(self, extension_id: str, credentials: CredentialStore) -> ExtensionCatalogResponse:
        self._require_known(extension_id)
        with self._lock:
            state = self._state.extensions.setdefault(extension_id, _InstalledExtension())
            state.installed = True
            state.enabled = True
            self._write()
        return self.catalog(credentials)

    def uninstall(
        self, extension_id: str, credentials: CredentialStore
    ) -> ExtensionCatalogResponse:
        self._require_known(extension_id)
        with self._lock:
            self._state.extensions.pop(extension_id, None)
            self._write()
        credentials.delete(TRELLIS_CREDENTIAL)
        return self.catalog(credentials)

    def enable(
        self, extension_id: str, enabled: bool, credentials: CredentialStore
    ) -> ExtensionCatalogResponse:
        self._require_known(extension_id)
        with self._lock:
            state = self._state.extensions.get(extension_id)
            if state is None or not state.installed:
                raise ExtensionError("Install the extension before enabling it")
            state.enabled = enabled
            self._write()
        return self.catalog(credentials)

    def connect_trellis(
        self,
        endpoint: str,
        api_token: str,
        credentials: CredentialStore,
    ) -> ExtensionCatalogResponse:
        self._verify_connection(endpoint, api_token)
        with self._lock:
            state = self._state.extensions.get(TRELLIS_ID)
            if state is None or not state.installed:
                raise ExtensionError("Install TRELLIS.2 before connecting a worker")
            state.endpoint = endpoint
            credentials.set(TRELLIS_CREDENTIAL, api_token)
            self._write()
        return self.catalog(credentials)

    @staticmethod
    def _verify_remote_worker(endpoint: str, api_token: str) -> None:
        try:
            response = httpx.post(
                f"{endpoint}/v1/auth/verify",
                headers={"Authorization": f"Bearer {api_token}"},
                json={"client": "marul3D"},
                timeout=8,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ExtensionError(
                "TRELLIS worker authentication failed. Check the endpoint and token."
            ) from exc

    def disconnect_trellis(self, credentials: CredentialStore) -> ExtensionCatalogResponse:
        with self._lock:
            state = self._state.extensions.get(TRELLIS_ID)
            if state is None or not state.installed:
                raise ExtensionError("TRELLIS.2 is not installed")
            state.endpoint = None
            credentials.delete(TRELLIS_CREDENTIAL)
            self._write()
        return self.catalog(credentials)

    @staticmethod
    def _require_known(extension_id: str) -> None:
        if extension_id != TRELLIS_ID:
            raise ExtensionError(f"Unknown extension {extension_id!r}")

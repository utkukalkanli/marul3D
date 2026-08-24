from pathlib import Path

import pytest
from pydantic import ValidationError

from marul3d_api.extension_store import TRELLIS_CREDENTIAL, ExtensionError, ExtensionStore
from marul3d_api.models import TrellisConnectionRequest


class MemoryCredentials:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def get(self, provider: str) -> tuple[str | None, str]:
        return self.values.get(provider), "keychain"

    def set(self, provider: str, value: str) -> None:
        self.values[provider] = value

    def delete(self, provider: str) -> None:
        self.values.pop(provider, None)


def test_trellis_install_connect_enable_and_persist(tmp_path: Path) -> None:
    credentials = MemoryCredentials()
    verified: list[tuple[str, str]] = []
    store = ExtensionStore(
        tmp_path, verify_connection=lambda endpoint, token: verified.append((endpoint, token))
    )

    installed = store.install("marul.trellis", credentials)
    assert installed.extensions[0].installed is True
    assert installed.extensions[0].enabled is True
    assert installed.extensions[0].authenticated is False

    connected = store.connect_trellis(
        "https://gpu.example.com", "secret-token", credentials
    )
    assert connected.extensions[0].authenticated is True
    assert connected.extensions[0].endpoint == "https://gpu.example.com"
    assert credentials.values[TRELLIS_CREDENTIAL] == "secret-token"
    assert verified == [("https://gpu.example.com", "secret-token")]
    assert "secret-token" not in (tmp_path / "extensions.json").read_text()

    restored = ExtensionStore(tmp_path).catalog(credentials)
    assert restored.extensions[0].authenticated is True
    disabled = store.enable("marul.trellis", False, credentials)
    assert disabled.extensions[0].enabled is False

    disconnected = store.disconnect_trellis(credentials)
    assert disconnected.extensions[0].authenticated is False
    assert TRELLIS_CREDENTIAL not in credentials.values


def test_extension_permissions_and_endpoint_validation(tmp_path: Path) -> None:
    credentials = MemoryCredentials()
    store = ExtensionStore(tmp_path)
    catalog = store.catalog(credentials)
    assert {permission.id for permission in catalog.extensions[0].permissions} == {
        "network:configured-endpoint",
        "object:write-reference",
        "agent:contribute-tool",
    }
    with pytest.raises(ExtensionError):
        store.enable("marul.trellis", True, credentials)
    with pytest.raises(ValidationError):
        TrellisConnectionRequest(endpoint="http://example.com", api_token="12345678")
    with pytest.raises(ValidationError):
        TrellisConnectionRequest(endpoint="http://localhost.evil.test", api_token="12345678")
    assert (
        TrellisConnectionRequest(
            endpoint="http://localhost:8080/", api_token="12345678"
        ).endpoint
        == "http://localhost:8080"
    )

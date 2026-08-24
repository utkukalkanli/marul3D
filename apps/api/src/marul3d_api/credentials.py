from __future__ import annotations

import os
import sys

import keyring
from keyring.errors import KeyringError

SERVICE_NAME = "com.marul3d.app"


class CredentialStore:
    def get(self, provider: str) -> tuple[str | None, str]:
        env_name = f"MARUL3D_{provider.upper()}_API_KEY"
        if value := os.getenv(env_name):
            return value, "environment"

        try:
            value = keyring.get_password(SERVICE_NAME, provider)
        except KeyringError:
            return None, "unavailable"
        return value, "keychain" if sys.platform == "darwin" else "unavailable"

    def set(self, provider: str, api_key: str) -> None:
        try:
            keyring.set_password(SERVICE_NAME, provider, api_key)
        except KeyringError as exc:
            raise RuntimeError("macOS Keychain is unavailable") from exc

    def delete(self, provider: str) -> None:
        try:
            keyring.delete_password(SERVICE_NAME, provider)
        except keyring.errors.PasswordDeleteError:
            return
        except KeyringError as exc:
            raise RuntimeError("macOS Keychain is unavailable") from exc

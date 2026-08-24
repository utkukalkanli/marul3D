from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import Protocol

import httpx

from marul3d_api.agent_tools import ALLOWED_AGENT_TOOLS, AgentOperation

SYSTEM_PROMPT = """You are Marul Agent, a conversational CAD design agent inside marul3D.
You have exactly five tools and no shell, web, or general filesystem access.

Rules:
1. Call read_document before reasoning about the current object.
2. If the request is ambiguous, physically implausible, organic/sculptural, or missing dimensions,
   call ask_clarification with one focused question and useful options. Then stop.
   Do not invent geometry.
3. For a CAD change, call propose_features with the entire valid CadDocument JSON
   and a concise summary.
4. Call build_preview. If it fails, repair the proposal and retry at most twice
   (three builds total).
5. Only after validation succeeds, call apply_document. This requests user approval;
   it does not apply.
6. Never claim a change was applied. Say it is ready for review.
7. Keep answers concise and conversational. Explain capability limits plainly.

The supported feature schema is present in the document returned by read_document. Prefer normal
parametric features. custom_cadquery is a constrained fallback for exact parametric B-rep geometry,
not a general sculpting or mesh-generation escape hatch.
"""

DISABLED_BUILTIN_TOOLS = (
    "bash",
    "read",
    "write",
    "edit",
    "patch",
    "glob",
    "grep",
    "list",
    "webfetch",
    "websearch",
    "codesearch",
    "task",
    "skill",
    "todowrite",
    "todoread",
)


class AgentRuntime(Protocol):
    def run(
        self,
        operation: AgentOperation,
        prompt: str,
        model: str,
        api_key: str,
        session_id: str | None,
    ) -> tuple[str, str | None]: ...


class OpenCodeRuntime:
    """Local, headless OpenCode sidecar with all built-in capabilities denied."""

    def __init__(self, api_base: str, internal_token: str) -> None:
        self.api_base = api_base.rstrip("/")
        self.internal_token = internal_token
        self._process: subprocess.Popen[bytes] | None = None
        self._port: int | None = None
        self._key_fingerprint: int | None = None
        self._lock = threading.RLock()
        self.config_dir = Path(__file__).with_name("opencode_config")

    @staticmethod
    def available() -> bool:
        return shutil.which("opencode") is not None

    @staticmethod
    def _free_port() -> int:
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            return int(listener.getsockname()[1])

    def _ensure_server(self, api_key: str) -> None:
        with self._lock:
            fingerprint = hash(api_key)
            if (
                self._process
                and self._process.poll() is None
                and fingerprint == self._key_fingerprint
            ):
                return
            self.close()
            executable = shutil.which("opencode")
            if not executable:
                raise RuntimeError(
                    "OpenCode is not installed. Install it before using Marul Agent."
                )
            self._port = self._free_port()
            environment = os.environ.copy()
            environment.update(
                {
                    "OPENAI_API_KEY": api_key,
                    "OPENCODE_CONFIG_DIR": str(self.config_dir),
                    "OPENCODE_CONFIG": str(self.config_dir / "opencode.json"),
                    "MARUL3D_AGENT_BASE_URL": self.api_base,
                    "MARUL3D_AGENT_TOKEN": self.internal_token,
                }
            )
            self._process = subprocess.Popen(
                [
                    executable,
                    "serve",
                    "--hostname",
                    "127.0.0.1",
                    "--port",
                    str(self._port),
                ],
                env=environment,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self._key_fingerprint = fingerprint
            health_url = f"http://127.0.0.1:{self._port}/global/health"
            for _ in range(80):
                if self._process.poll() is not None:
                    break
                try:
                    if httpx.get(health_url, timeout=0.4).is_success:
                        return
                except httpx.HTTPError:
                    pass
                time.sleep(0.1)
            self.close()
            raise RuntimeError("OpenCode sidecar did not start")

    def run(
        self,
        operation: AgentOperation,
        prompt: str,
        model: str,
        api_key: str,
        session_id: str | None,
    ) -> tuple[str, str | None]:
        self._ensure_server(api_key)
        assert self._port is not None
        runtime_dir = operation.project.root / "agent-runtime"
        runtime_dir.mkdir(exist_ok=True)
        context_path = runtime_dir / ".marul-agent-context.json"
        context_path.write_text(json.dumps({"operation_id": operation.id}), encoding="utf-8")
        base = f"http://127.0.0.1:{self._port}"
        query = {"directory": str(runtime_dir)}
        with httpx.Client(base_url=base, timeout=180) as client:
            if not session_id:
                created = client.post("/session", params=query, json={"title": "Marul Agent"})
                created.raise_for_status()
                session_id = created.json()["id"]
            response = client.post(
                f"/session/{session_id}/message",
                params=query,
                json={
                    "model": {"providerID": "openai", "modelID": model},
                    "agent": "marul",
                    "system": SYSTEM_PROMPT,
                    "tools": {
                        **{name: False for name in DISABLED_BUILTIN_TOOLS},
                        **{name: True for name in ALLOWED_AGENT_TOOLS},
                    },
                    "parts": [{"type": "text", "text": prompt}],
                },
            )
            response.raise_for_status()
            payload = response.json()
        text = "".join(
            str(part.get("text", ""))
            for part in payload.get("parts", [])
            if part.get("type") == "text"
        ).strip()
        return text or "I finished reviewing the request.", session_id

    def close(self) -> None:
        with self._lock:
            if self._process and self._process.poll() is None:
                self._process.terminate()
                try:
                    self._process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self._process.kill()
            self._process = None
            self._port = None
            self._key_fingerprint = None

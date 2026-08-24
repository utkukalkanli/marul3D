from __future__ import annotations

import threading
from pathlib import Path

from marul3d_api.models import AgentConversation


class AgentStore:
    """Object-scoped, local persistence for Marul Agent conversations."""

    def __init__(self, root: Path) -> None:
        self.path = root / "agent.json"
        self._lock = threading.RLock()
        self._conversation = self._load()

    def _load(self) -> AgentConversation:
        if not self.path.exists():
            return AgentConversation()
        try:
            return AgentConversation.model_validate_json(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return AgentConversation()

    def read(self) -> AgentConversation:
        with self._lock:
            return self._conversation.model_copy(deep=True)

    def write(self, conversation: AgentConversation) -> AgentConversation:
        with self._lock:
            self._conversation = conversation.model_copy(deep=True)
            temporary = self.path.with_suffix(".json.tmp")
            temporary.write_text(self._conversation.model_dump_json(indent=2), encoding="utf-8")
            temporary.replace(self.path)
            return self.read()

    def mutate(self, mutation) -> AgentConversation:
        with self._lock:
            candidate = self._conversation.model_copy(deep=True)
            mutation(candidate)
            return self.write(candidate)

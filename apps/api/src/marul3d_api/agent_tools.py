from __future__ import annotations

import queue
import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from marul3d_api.agent_store import AgentStore
from marul3d_api.build_engine import BuildError, build_document
from marul3d_api.models import (
    AgentProposal,
    AgentToolEvent,
    CadDocument,
    FeatureDiff,
)
from marul3d_api.project_store import ProjectStore

ALLOWED_AGENT_TOOLS = (
    "read_document",
    "ask_clarification",
    "propose_features",
    "build_preview",
    "apply_document",
)

TOOL_LABELS = {
    "read_document": "Planning",
    "ask_clarification": "Planning",
    "propose_features": "Building",
    "build_preview": "Validating",
    "apply_document": "Ready to apply",
}


@dataclass
class AgentOperation:
    id: str
    project: ProjectStore
    agent: AgentStore
    events: queue.Queue[dict[str, Any]] = field(default_factory=queue.Queue)
    clarification: tuple[str, list[str]] | None = None
    build_attempts: int = 0

    def emit(self, event: str, data: Any) -> None:
        self.events.put({"event": event, "data": data})


def feature_diff(before: CadDocument, after: CadDocument) -> FeatureDiff:
    old = {feature.id: feature for feature in before.features}
    new = {feature.id: feature for feature in after.features}
    return FeatureDiff(
        added=[new[key].name for key in new.keys() - old.keys()],
        removed=[old[key].name for key in old.keys() - new.keys()],
        modified=[
            new[key].name
            for key in new.keys() & old.keys()
            if new[key].model_dump(mode="json") != old[key].model_dump(mode="json")
        ],
    )


class ToolRegistry:
    """The only effect boundary available to the invisible agent runtime."""

    def __init__(self) -> None:
        self._handlers: dict[str, Callable[[AgentOperation, dict[str, Any]], dict[str, Any]]] = {}

    @property
    def names(self) -> tuple[str, ...]:
        return tuple(self._handlers)

    def register(self, name: str, handler) -> None:
        if name not in ALLOWED_AGENT_TOOLS:
            raise ValueError(f"Agent tool {name!r} is not in the marul3D allowlist")
        self._handlers[name] = handler

    def execute(
        self, operation: AgentOperation, name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        handler = self._handlers.get(name)
        if handler is None:
            raise KeyError(f"Tool {name!r} is unavailable")
        event_id = f"tool-{uuid.uuid4().hex[:12]}"
        label = TOOL_LABELS[name]
        if name == "build_preview" and operation.build_attempts:
            label = "Repairing"
        tool_event = AgentToolEvent(id=event_id, tool=name, label=label, status="running")
        operation.agent.mutate(lambda value: value.tool_events.append(tool_event))
        operation.emit("tool", tool_event.model_dump(mode="json"))
        try:
            result = handler(operation, payload)
        except Exception as exc:
            self._finish(operation, event_id, "failed", str(exc))
            raise
        if name == "apply_document":
            status = "awaiting_approval"
        elif name == "build_preview" and result.get("valid") is False:
            status = "failed"
        else:
            status = "completed"
        self._finish(operation, event_id, status, result.get("detail"))
        return result

    @staticmethod
    def _finish(
        operation: AgentOperation,
        event_id: str,
        status: str,
        detail: str | None,
    ) -> None:
        def update(value) -> None:
            for item in value.tool_events:
                if item.id == event_id:
                    item.status = status
                    item.detail = detail

        conversation = operation.agent.mutate(update)
        event = next(item for item in conversation.tool_events if item.id == event_id)
        operation.emit("tool", event.model_dump(mode="json"))


class AgentToolService:
    def __init__(self) -> None:
        self._operations: dict[str, AgentOperation] = {}
        self._lock = threading.RLock()
        self.registry = ToolRegistry()
        self.registry.register("read_document", self._read_document)
        self.registry.register("ask_clarification", self._ask_clarification)
        self.registry.register("propose_features", self._propose_features)
        self.registry.register("build_preview", self._build_preview)
        self.registry.register("apply_document", self._apply_document)

    def create_operation(self, project: ProjectStore, agent: AgentStore) -> AgentOperation:
        operation = AgentOperation(f"operation-{uuid.uuid4().hex}", project, agent)
        with self._lock:
            self._operations[operation.id] = operation
        return operation

    def finish_operation(self, operation_id: str) -> None:
        with self._lock:
            self._operations.pop(operation_id, None)

    def execute(self, operation_id: str, name: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            operation = self._operations.get(operation_id)
        if operation is None:
            raise KeyError("Agent operation expired")
        return self.registry.execute(operation, name, payload)

    @staticmethod
    def _read_document(operation: AgentOperation, payload: dict[str, Any]) -> dict[str, Any]:
        document = operation.project.document().model_copy(deep=True)
        for feature in document.features:
            if hasattr(feature, "source_path"):
                feature.source_path = "[local CAD asset]"
        return {"document": document.model_dump(mode="json"), "detail": "Document read"}

    @staticmethod
    def _ask_clarification(operation: AgentOperation, payload: dict[str, Any]) -> dict[str, Any]:
        question = str(payload.get("question", "")).strip()
        options = [str(item).strip() for item in payload.get("options", []) if str(item).strip()]
        if not question:
            raise ValueError("A clarification question is required")
        operation.clarification = (question, options[:5])
        return {"question": question, "options": options[:5], "detail": "Waiting for user"}

    @staticmethod
    def _propose_features(operation: AgentOperation, payload: dict[str, Any]) -> dict[str, Any]:
        raw = payload.get("document_json", payload.get("document"))
        try:
            candidate = (
                CadDocument.model_validate_json(raw)
                if isinstance(raw, str)
                else CadDocument.model_validate(raw)
            )
        except (ValidationError, ValueError) as exc:
            raise ValueError(f"Invalid CAD document proposal: {exc}") from exc
        before = operation.project.document()
        candidate.revision = before.revision
        proposal = AgentProposal(
            id=f"proposal-{uuid.uuid4().hex[:12]}",
            summary=str(payload.get("summary", "Proposed CAD changes")).strip(),
            document=candidate,
            diff=feature_diff(before, candidate),
            build_attempts=operation.build_attempts,
        )

        def update(value) -> None:
            value.proposal = proposal

        operation.agent.mutate(update)
        operation.emit("proposal", proposal.model_dump(mode="json"))
        return {
            "proposal_id": proposal.id,
            "diff": proposal.diff.model_dump(),
            "detail": "Feature diff prepared",
        }

    @staticmethod
    def _build_preview(operation: AgentOperation, payload: dict[str, Any]) -> dict[str, Any]:
        conversation = operation.agent.read()
        proposal = conversation.proposal
        if proposal is None:
            raise ValueError("Call propose_features before build_preview")
        if operation.build_attempts >= 3:
            raise ValueError("Preview repair limit reached (initial build plus two repairs)")
        operation.build_attempts += 1
        proposal.build_attempts = operation.build_attempts
        proposal.status = "validating"
        operation.agent.mutate(lambda value: setattr(value, "proposal", proposal))
        try:
            shape = build_document(proposal.document)
            bounds = shape.val().BoundingBox()
        except BuildError as exc:
            proposal.status = "invalid"
            proposal.error = str(exc)
            operation.agent.mutate(lambda value: setattr(value, "proposal", proposal))
            operation.emit("proposal", proposal.model_dump(mode="json"))
            return {
                "valid": False,
                "error": str(exc),
                "attempt": proposal.build_attempts,
                "repairs_remaining": 3 - proposal.build_attempts,
                "detail": str(exc),
            }
        proposal.status = "ready"
        proposal.error = None
        operation.agent.mutate(lambda value: setattr(value, "proposal", proposal))
        operation.emit("proposal", proposal.model_dump(mode="json"))
        return {
            "valid": True,
            "attempt": proposal.build_attempts,
            "bounds_mm": [bounds.xlen, bounds.ylen, bounds.zlen],
            "detail": "B-rep preview is valid",
        }

    @staticmethod
    def _apply_document(operation: AgentOperation, payload: dict[str, Any]) -> dict[str, Any]:
        conversation = operation.agent.read()
        proposal = conversation.proposal
        if proposal is None or proposal.status != "ready":
            raise ValueError("A validated proposal is required before requesting apply")
        # Deliberately no ProjectStore.apply here: only the UI approval endpoint mutates CAD.
        return {
            "approval_required": True,
            "proposal_id": proposal.id,
            "detail": "User approval required",
        }

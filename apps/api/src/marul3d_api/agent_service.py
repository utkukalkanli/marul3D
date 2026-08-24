from __future__ import annotations

import json
import os
import queue
import secrets
import threading
import time
import uuid
from collections.abc import Iterator
from typing import Any

from marul3d_api.agent_runtime import AgentRuntime, OpenCodeRuntime
from marul3d_api.agent_store import AgentStore
from marul3d_api.agent_tools import AgentToolService
from marul3d_api.models import AgentConversation, AgentMessage
from marul3d_api.project_store import ProjectStore


def sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


class AgentService:
    def __init__(self, runtime: AgentRuntime | None = None) -> None:
        self.internal_token = secrets.token_urlsafe(32)
        api_base = os.getenv("MARUL3D_API_BASE_URL", "http://127.0.0.1:8000")
        self.runtime = runtime or OpenCodeRuntime(api_base, self.internal_token)
        self.tools = AgentToolService()

    @staticmethod
    def store(project: ProjectStore) -> AgentStore:
        return AgentStore(project.root)

    def conversation(self, project: ProjectStore) -> AgentConversation:
        return self.store(project).read()

    def stream(
        self,
        project: ProjectStore,
        prompt: str,
        model: str,
        api_key: str,
    ) -> Iterator[str]:
        agent = self.store(project)

        def start(value: AgentConversation) -> None:
            value.tool_events = []
            if value.proposal and value.proposal.status in {
                "draft",
                "validating",
                "invalid",
                "ready",
            }:
                value.proposal.status = "discarded"
            value.messages.append(
                AgentMessage(id=f"message-{uuid.uuid4().hex}", role="user", text=prompt)
            )

        conversation = agent.mutate(start)
        operation = self.tools.create_operation(project, agent)
        finished = threading.Event()

        def work() -> None:
            try:
                text, session_id = self.runtime.run(
                    operation,
                    prompt,
                    model,
                    api_key,
                    conversation.opencode_session_id,
                )
                current = agent.read()
                if operation.clarification:
                    text, options = operation.clarification
                    kind = "clarification"
                else:
                    options = []
                    kind = (
                        "proposal"
                        if current.proposal and current.proposal.status == "ready"
                        else "message"
                    )
                message = AgentMessage(
                    id=f"message-{uuid.uuid4().hex}",
                    role="assistant",
                    text=text,
                    kind=kind,
                    options=options,
                )

                def complete(value: AgentConversation) -> None:
                    value.opencode_session_id = session_id
                    value.messages.append(message)

                final = agent.mutate(complete)
                for offset in range(0, len(message.text), 18):
                    operation.emit(
                        "delta",
                        {"message_id": message.id, "text": message.text[offset : offset + 18]},
                    )
                    time.sleep(0.018)
                operation.emit("conversation", final.model_dump(mode="json"))
            except Exception as exc:
                message = AgentMessage(
                    id=f"message-{uuid.uuid4().hex}",
                    role="assistant",
                    text=f"Marul Agent stopped: {exc}",
                    kind="error",
                )
                final = agent.mutate(lambda value: value.messages.append(message))
                operation.emit("error", {"detail": str(exc)})
                operation.emit("conversation", final.model_dump(mode="json"))
            finally:
                operation.emit("done", {})
                finished.set()

        threading.Thread(target=work, daemon=True, name="marul-agent").start()
        yield sse("conversation", conversation.model_dump(mode="json"))
        while not (finished.is_set() and operation.events.empty()):
            try:
                item = operation.events.get(timeout=0.25)
            except queue.Empty:
                yield ": keep-alive\n\n"
                continue
            yield sse(item["event"], item["data"])
        self.tools.finish_operation(operation.id)

    def apply(self, project: ProjectStore) -> tuple[Any, AgentConversation]:
        agent = self.store(project)
        conversation = agent.read()
        proposal = conversation.proposal
        if proposal is None or proposal.status != "ready":
            raise ValueError("There is no validated proposal awaiting approval")
        built = project.apply(proposal.document)

        def complete(value: AgentConversation) -> None:
            assert value.proposal is not None
            value.proposal.status = "applied"
            value.messages.append(
                AgentMessage(
                    id=f"message-{uuid.uuid4().hex}",
                    role="assistant",
                    text="Changes applied to the local CAD document.",
                )
            )

        return built, agent.mutate(complete)

    def discard(self, project: ProjectStore) -> AgentConversation:
        agent = self.store(project)

        def discard(value: AgentConversation) -> None:
            if value.proposal and value.proposal.status in {
                "draft",
                "validating",
                "invalid",
                "ready",
            }:
                value.proposal.status = "discarded"
            for event in value.tool_events:
                if event.status == "awaiting_approval":
                    event.status = "completed"
                    event.label = "Discarded"
                    event.detail = "CAD document unchanged"
            value.messages.append(
                AgentMessage(
                    id=f"message-{uuid.uuid4().hex}",
                    role="assistant",
                    text="Proposed changes discarded. The CAD document was not changed.",
                )
            )

        return agent.mutate(discard)

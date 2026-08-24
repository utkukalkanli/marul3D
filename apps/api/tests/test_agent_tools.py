from pathlib import Path

import pytest

from marul3d_api.agent_service import AgentService
from marul3d_api.agent_store import AgentStore
from marul3d_api.agent_tools import AgentToolService
from marul3d_api.project_store import ProjectStore


def test_proposal_is_validated_but_not_applied_until_ui_approval(tmp_path: Path) -> None:
    project = ProjectStore(tmp_path)
    agent = AgentStore(tmp_path)
    tools = AgentToolService()
    operation = tools.create_operation(project, agent)
    original = project.document()
    candidate = original.model_copy(deep=True)
    candidate.features[0].width = 55

    tools.execute(
        operation.id,
        "propose_features",
        {"summary": "Widen the base", "document": candidate.model_dump(mode="json")},
    )
    validation = tools.execute(operation.id, "build_preview", {})
    approval = tools.execute(operation.id, "apply_document", {})

    assert validation["valid"] is True
    assert approval["approval_required"] is True
    assert project.document().revision == original.revision
    assert project.document().features[0].width == original.features[0].width

    service = AgentService(runtime=object())
    built, conversation = service.apply(project)
    assert built.revision == original.revision + 1
    assert built.features[0].width == 55
    assert conversation.proposal is not None
    assert conversation.proposal.status == "applied"


def test_agent_history_persists_and_tool_allowlist_is_enforced(tmp_path: Path) -> None:
    project = ProjectStore(tmp_path)
    first_store = AgentStore(tmp_path)
    tools = AgentToolService()
    operation = tools.create_operation(project, first_store)
    tools.execute(
        operation.id,
        "ask_clarification",
        {"question": "How large?", "options": ["Small", "Large"]},
    )

    restored = AgentStore(tmp_path).read()
    assert restored.tool_events[-1].label == "Planning"
    assert operation.clarification == ("How large?", ["Small", "Large"])
    with pytest.raises(KeyError):
        tools.execute(operation.id, "bash", {"command": "pwd"})


def test_preview_has_initial_build_plus_two_repairs(tmp_path: Path) -> None:
    project = ProjectStore(tmp_path)
    agent = AgentStore(tmp_path)
    tools = AgentToolService()
    operation = tools.create_operation(project, agent)
    invalid = project.document().model_copy(deep=True)
    invalid.features = []
    tools.execute(
        operation.id,
        "propose_features",
        {"summary": "Invalid empty part", "document": invalid.model_dump(mode="json")},
    )

    for expected in (1, 2, 3):
        result = tools.execute(operation.id, "build_preview", {})
        assert result["valid"] is False
        assert result["attempt"] == expected
        if expected < 3:
            tools.execute(
                operation.id,
                "propose_features",
                {"summary": "Still invalid", "document": invalid.model_dump(mode="json")},
            )
    with pytest.raises(ValueError, match="repair limit"):
        tools.execute(operation.id, "build_preview", {})

from pathlib import Path

from marul3d_api.hierarchy_store import WorkspaceStore
from marul3d_api.project_store import ProjectStore


def test_hierarchy_persists_across_store_restarts(tmp_path: Path) -> None:
    store = WorkspaceStore(tmp_path)
    workspace = store.create_workspace("Engineering")
    workspace_id = workspace.selected_workspace_id
    assert workspace_id is not None
    project = store.create_project(workspace_id, "Robot Arm")
    project_id = project.selected_project_id
    assert project_id is not None
    cad_object = store.create_object(workspace_id, project_id, "Joint Housing")
    object_id = cad_object.selected_object_id
    assert object_id is not None

    reloaded = WorkspaceStore(tmp_path)
    hierarchy = reloaded.hierarchy(workspace_id, project_id, object_id)

    assert hierarchy.selected_object_id == object_id
    assert reloaded.object_store(workspace_id, project_id, object_id).document().name == (
        "Joint Housing"
    )


def test_legacy_document_is_migrated_without_removal(tmp_path: Path) -> None:
    legacy = ProjectStore(tmp_path)
    legacy.rename("Legacy Gearbox")

    hierarchy = WorkspaceStore(tmp_path).hierarchy()

    assert hierarchy.workspaces[0].projects[0].objects[0].name == "Legacy Gearbox"
    assert (tmp_path / "document.json").exists()
    assert (tmp_path / "preview.stl").exists()

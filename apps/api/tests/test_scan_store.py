from pathlib import Path

import pytest

from marul3d_api.hierarchy_store import WorkspaceStore
from marul3d_api.scan_store import ScanError, ScanStore


def test_ready_scan_can_be_copied_as_a_local_stl_reference(tmp_path: Path) -> None:
    scans = ScanStore()
    assert scans.catalog().account_mode == "local"
    content = scans.stl_bytes("scan-ceramic-vase")
    assert content.startswith(b"solid Ceramic_studio_vase")

    workspace = WorkspaceStore(tmp_path)
    hierarchy = workspace.hierarchy()
    workspace_id = hierarchy.selected_workspace_id
    project_id = hierarchy.selected_project_id
    assert workspace_id and project_id

    created = workspace.create_object(workspace_id, project_id, "Vase scan")
    object_id = created.selected_object_id
    assert object_id
    target = workspace.object_store(workspace_id, project_id, object_id)
    document = target.import_file("vase.stl", content)
    target.rename("Vase scan")
    assert document.features[0].type == "import_stl"
    assert target.preview_path.read_bytes() == content


def test_processing_scan_cannot_be_copied() -> None:
    with pytest.raises(ScanError):
        ScanStore().stl_bytes("scan-rock-study")

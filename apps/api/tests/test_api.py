from pathlib import Path

from fastapi.testclient import TestClient

from marul3d_api.main import app, get_store


def _object_base(payload: dict[str, object]) -> str:
    return (
        f"/api/workspaces/{payload['selected_workspace_id']}"
        f"/projects/{payload['selected_project_id']}"
        f"/objects/{payload['selected_object_id']}"
    )


def test_default_hierarchy_document_and_preview(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("MARUL3D_DATA_DIR", str(tmp_path))
    get_store.cache_clear()
    with TestClient(app) as client:
        hierarchy = client.get("/api/workspaces")
        assert hierarchy.status_code == 200
        payload = hierarchy.json()
        assert payload["workspaces"][0]["name"] == "My Workspace"
        assert payload["workspaces"][0]["projects"][0]["name"] == "First Project"

        object_base = _object_base(payload)
        response = client.get(f"{object_base}/document")
        assert response.status_code == 200
        assert response.json()["document"]["name"] == "Starter mounting plate"

        preview = client.get(f"{object_base}/preview.stl")
        assert preview.status_code == 200
        assert len(preview.content) > 1_000
    get_store.cache_clear()


def test_workspace_project_and_object_crud(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("MARUL3D_DATA_DIR", str(tmp_path))
    get_store.cache_clear()
    with TestClient(app) as client:
        workspace = client.post("/api/workspaces", json={"name": "Engineering"}).json()
        workspace_id = workspace["selected_workspace_id"]
        assert workspace["selected_project_id"] is None

        project = client.post(
            f"/api/workspaces/{workspace_id}/projects",
            json={"name": "Robot Arm"},
        ).json()
        project_id = project["selected_project_id"]
        assert project["selected_object_id"] is None

        first = client.post(
            f"/api/workspaces/{workspace_id}/projects/{project_id}/objects",
            json={"name": "Joint Housing"},
        ).json()
        first_object_id = first["selected_object_id"]
        first_base = _object_base(first)
        assert (
            client.get(f"{first_base}/document").json()["document"]["name"]
            == "Joint Housing"
        )

        renamed = client.put(first_base, json={"name": "Joint Housing v2"}).json()
        renamed_workspace = next(
            item for item in renamed["workspaces"] if item["id"] == workspace_id
        )
        renamed_project = next(
            item for item in renamed_workspace["projects"] if item["id"] == project_id
        )
        assert renamed_project["objects"][0]["name"] == "Joint Housing v2"

        second = client.post(
            f"/api/workspaces/{workspace_id}/projects/{project_id}/objects",
            json={"name": "End Effector"},
        ).json()
        assert second["selected_object_id"] != first_object_id

        deleted = client.delete(first_base)
        assert deleted.status_code == 200
        assert deleted.json()["selected_object_id"] == second["selected_object_id"]

        assert (
            client.delete(f"/api/workspaces/{workspace_id}/projects/{project_id}").status_code
            == 200
        )
        assert client.delete(f"/api/workspaces/{workspace_id}").status_code == 200
    get_store.cache_clear()

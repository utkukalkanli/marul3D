from pathlib import Path

from fastapi.testclient import TestClient

from marul3d_api.main import app, get_store


def test_document_and_preview(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("MARUL3D_DATA_DIR", str(tmp_path))
    get_store.cache_clear()
    with TestClient(app) as client:
        response = client.get("/api/document")
        assert response.status_code == 200
        assert response.json()["document"]["name"] == "Starter mounting plate"

        preview = client.get("/api/preview.stl")
        assert preview.status_code == 200
        assert len(preview.content) > 1_000
    get_store.cache_clear()

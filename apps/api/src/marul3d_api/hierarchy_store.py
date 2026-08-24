from __future__ import annotations

import os
import shutil
import threading
import uuid
from pathlib import Path

from platformdirs import user_data_path
from pydantic import BaseModel, ConfigDict

from marul3d_api.models import (
    CadDocument,
    CadObjectSummary,
    HierarchyResponse,
    ProjectSummary,
    WorkspaceSummary,
    sample_document,
)
from marul3d_api.project_store import ProjectStore


class HierarchyError(ValueError):
    pass


class _Record(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _ObjectRecord(_Record):
    id: str


class _ProjectRecord(_Record):
    id: str
    name: str
    objects: list[_ObjectRecord]


class _WorkspaceRecord(_Record):
    id: str
    name: str
    projects: list[_ProjectRecord]


class _Catalog(_Record):
    schema_version: int = 1
    workspaces: list[_WorkspaceRecord]


class WorkspaceStore:
    def __init__(self, root: Path | None = None) -> None:
        configured = os.getenv("MARUL3D_DATA_DIR")
        self.root = root or (Path(configured) if configured else user_data_path("marul3D"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.catalog_path = self.root / "catalog.json"
        self.workspaces_root = self.root / "workspaces"
        self.trash_root = self.root / ".trash"
        self.workspaces_root.mkdir(exist_ok=True)
        self.trash_root.mkdir(exist_ok=True)
        self._lock = threading.RLock()
        self._stores: dict[tuple[str, str, str], ProjectStore] = {}
        self._catalog = self._load_or_migrate()

    @staticmethod
    def _id(prefix: str) -> str:
        return f"{prefix}-{uuid.uuid4().hex[:10]}"

    def _object_root(self, workspace_id: str, project_id: str, object_id: str) -> Path:
        return (
            self.workspaces_root
            / workspace_id
            / "projects"
            / project_id
            / "objects"
            / object_id
        )

    def _load_or_migrate(self) -> _Catalog:
        if self.catalog_path.exists():
            return _Catalog.model_validate_json(self.catalog_path.read_text(encoding="utf-8"))

        workspace_id = self._id("workspace")
        project_id = self._id("project")
        object_id = self._id("object")
        object_root = self._object_root(workspace_id, project_id, object_id)
        object_root.mkdir(parents=True, exist_ok=True)

        legacy_document = self.root / "document.json"
        legacy_preview = self.root / "preview.stl"
        if legacy_document.exists():
            shutil.copy2(legacy_document, object_root / "document.json")
        if legacy_preview.exists():
            shutil.copy2(legacy_preview, object_root / "preview.stl")

        object_store = ProjectStore(object_root)
        self._stores[(workspace_id, project_id, object_id)] = object_store
        catalog = _Catalog(
            workspaces=[
                _WorkspaceRecord(
                    id=workspace_id,
                    name="My Workspace",
                    projects=[
                        _ProjectRecord(
                            id=project_id,
                            name="First Project",
                            objects=[_ObjectRecord(id=object_id)],
                        )
                    ],
                )
            ]
        )
        self._catalog = catalog
        self._write_catalog()
        return catalog

    def _write_catalog(self) -> None:
        temporary = self.catalog_path.with_suffix(".json.tmp")
        temporary.write_text(self._catalog.model_dump_json(indent=2), encoding="utf-8")
        temporary.replace(self.catalog_path)

    def _find_workspace(self, workspace_id: str) -> _WorkspaceRecord:
        workspace = next(
            (item for item in self._catalog.workspaces if item.id == workspace_id),
            None,
        )
        if workspace is None:
            raise HierarchyError("Workspace not found")
        return workspace

    def _find_project(self, workspace_id: str, project_id: str) -> _ProjectRecord:
        workspace = self._find_workspace(workspace_id)
        project = next((item for item in workspace.projects if item.id == project_id), None)
        if project is None:
            raise HierarchyError("Project not found")
        return project

    def _find_object(
        self,
        workspace_id: str,
        project_id: str,
        object_id: str,
    ) -> _ObjectRecord:
        project = self._find_project(workspace_id, project_id)
        cad_object = next((item for item in project.objects if item.id == object_id), None)
        if cad_object is None:
            raise HierarchyError("CAD object not found")
        return cad_object

    def object_store(self, workspace_id: str, project_id: str, object_id: str) -> ProjectStore:
        with self._lock:
            self._find_object(workspace_id, project_id, object_id)
            key = (workspace_id, project_id, object_id)
            if key not in self._stores:
                self._stores[key] = ProjectStore(self._object_root(*key))
            return self._stores[key]

    def hierarchy(
        self,
        workspace_id: str | None = None,
        project_id: str | None = None,
        object_id: str | None = None,
    ) -> HierarchyResponse:
        with self._lock:
            workspaces = [
                WorkspaceSummary(
                    id=workspace.id,
                    name=workspace.name,
                    projects=[
                        ProjectSummary(
                            id=project.id,
                            name=project.name,
                            objects=[
                                CadObjectSummary(
                                    id=cad_object.id,
                                    name=self.object_store(
                                        workspace.id,
                                        project.id,
                                        cad_object.id,
                                    ).document().name,
                                    revision=self.object_store(
                                        workspace.id,
                                        project.id,
                                        cad_object.id,
                                    ).document().revision,
                                )
                                for cad_object in project.objects
                            ],
                        )
                        for project in workspace.projects
                    ],
                )
                for workspace in self._catalog.workspaces
            ]

            selected_workspace = next(
                (item for item in workspaces if item.id == workspace_id),
                workspaces[0] if workspaces else None,
            )
            selected_project = next(
                (
                    item
                    for item in (selected_workspace.projects if selected_workspace else [])
                    if item.id == project_id
                ),
                selected_workspace.projects[0]
                if selected_workspace and selected_workspace.projects
                else None,
            )
            selected_object = next(
                (
                    item
                    for item in (selected_project.objects if selected_project else [])
                    if item.id == object_id
                ),
                selected_project.objects[0]
                if selected_project and selected_project.objects
                else None,
            )
            return HierarchyResponse(
                workspaces=workspaces,
                selected_workspace_id=selected_workspace.id if selected_workspace else None,
                selected_project_id=selected_project.id if selected_project else None,
                selected_object_id=selected_object.id if selected_object else None,
            )

    def create_workspace(self, name: str) -> HierarchyResponse:
        with self._lock:
            workspace = _WorkspaceRecord(id=self._id("workspace"), name=name, projects=[])
            self._catalog.workspaces.append(workspace)
            self._write_catalog()
            return self.hierarchy(workspace.id)

    def rename_workspace(self, workspace_id: str, name: str) -> HierarchyResponse:
        with self._lock:
            self._find_workspace(workspace_id).name = name
            self._write_catalog()
            return self.hierarchy(workspace_id)

    def delete_workspace(self, workspace_id: str) -> HierarchyResponse:
        with self._lock:
            workspace = self._find_workspace(workspace_id)
            self._catalog.workspaces.remove(workspace)
            self._stores = {
                key: value for key, value in self._stores.items() if key[0] != workspace_id
            }
            self._trash(self.workspaces_root / workspace_id)
            self._write_catalog()
            return self.hierarchy()

    def create_project(self, workspace_id: str, name: str) -> HierarchyResponse:
        with self._lock:
            workspace = self._find_workspace(workspace_id)
            project = _ProjectRecord(id=self._id("project"), name=name, objects=[])
            workspace.projects.append(project)
            self._write_catalog()
            return self.hierarchy(workspace_id, project.id)

    def rename_project(self, workspace_id: str, project_id: str, name: str) -> HierarchyResponse:
        with self._lock:
            self._find_project(workspace_id, project_id).name = name
            self._write_catalog()
            return self.hierarchy(workspace_id, project_id)

    def delete_project(self, workspace_id: str, project_id: str) -> HierarchyResponse:
        with self._lock:
            workspace = self._find_workspace(workspace_id)
            project = self._find_project(workspace_id, project_id)
            workspace.projects.remove(project)
            self._stores = {
                key: value
                for key, value in self._stores.items()
                if key[:2] != (workspace_id, project_id)
            }
            self._trash(self.workspaces_root / workspace_id / "projects" / project_id)
            self._write_catalog()
            return self.hierarchy(workspace_id)

    def create_object(self, workspace_id: str, project_id: str, name: str) -> HierarchyResponse:
        with self._lock:
            project = self._find_project(workspace_id, project_id)
            object_id = self._id("object")
            document: CadDocument = sample_document().model_copy(deep=True)
            document.id = object_id
            document.name = name
            document.revision = 0
            store = ProjectStore(
                self._object_root(workspace_id, project_id, object_id),
                initial_document=document,
            )
            project.objects.append(_ObjectRecord(id=object_id))
            self._stores[(workspace_id, project_id, object_id)] = store
            self._write_catalog()
            return self.hierarchy(workspace_id, project_id, object_id)

    def rename_object(
        self,
        workspace_id: str,
        project_id: str,
        object_id: str,
        name: str,
    ) -> HierarchyResponse:
        with self._lock:
            self.object_store(workspace_id, project_id, object_id).rename(name)
            return self.hierarchy(workspace_id, project_id, object_id)

    def delete_object(
        self,
        workspace_id: str,
        project_id: str,
        object_id: str,
    ) -> HierarchyResponse:
        with self._lock:
            project = self._find_project(workspace_id, project_id)
            cad_object = self._find_object(workspace_id, project_id, object_id)
            project.objects.remove(cad_object)
            self._stores.pop((workspace_id, project_id, object_id), None)
            self._trash(self._object_root(workspace_id, project_id, object_id))
            self._write_catalog()
            return self.hierarchy(workspace_id, project_id)

    def _trash(self, path: Path) -> None:
        if not path.exists():
            return
        destination = self.trash_root / f"{path.name}-{uuid.uuid4().hex}"
        path.replace(destination)

from __future__ import annotations

import json
import os
import shutil
import threading
import uuid
from pathlib import Path

from platformdirs import user_data_path

from marul3d_api.build_engine import BuildError, export_document, export_preview
from marul3d_api.models import (
    CadDocument,
    ImportStepFeature,
    ImportStlFeature,
    sample_document,
)


class ProjectStore:
    def __init__(
        self,
        root: Path | None = None,
        initial_document: CadDocument | None = None,
    ) -> None:
        configured = os.getenv("MARUL3D_DATA_DIR")
        self.root = root or (Path(configured) if configured else user_data_path("marul3D"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.imports = self.root / "imports"
        self.exports = self.root / "exports"
        self.imports.mkdir(exist_ok=True)
        self.exports.mkdir(exist_ok=True)
        self.document_path = self.root / "document.json"
        self.preview_path = self.root / "preview.stl"
        self._lock = threading.RLock()
        self._undo: list[CadDocument] = []
        self._redo: list[CadDocument] = []
        self._initial_document = (
            initial_document.model_copy(deep=True) if initial_document else None
        )
        self._document = self._load()
        self._ensure_preview()

    def _load(self) -> CadDocument:
        if not self.document_path.exists():
            return self._initial_document or sample_document()
        return CadDocument.model_validate_json(self.document_path.read_text(encoding="utf-8"))

    def _write_document(self) -> None:
        temporary = self.document_path.with_suffix(".json.tmp")
        temporary.write_text(
            self._document.model_dump_json(indent=2),
            encoding="utf-8",
        )
        temporary.replace(self.document_path)

    def _ensure_preview(self) -> None:
        if self.preview_path.exists():
            return
        if any(feature.type == "import_stl" for feature in self._document.features):
            source = Path(self._document.features[0].source_path)
            if source.exists():
                shutil.copy2(source, self.preview_path)
                return
        export_preview(self._document, self.preview_path)
        self._write_document()

    def document(self) -> CadDocument:
        with self._lock:
            return self._document.model_copy(deep=True)

    def rename(self, name: str) -> CadDocument:
        with self._lock:
            self._document.name = name
            self._write_document()
            return self.document()

    def apply(self, candidate: CadDocument, *, record_history: bool = True) -> CadDocument:
        with self._lock:
            next_document = candidate.model_copy(deep=True)
            next_document.revision = self._document.revision + 1
            temporary_preview = self.root / f"preview-{uuid.uuid4().hex}.stl"
            try:
                export_preview(next_document, temporary_preview)
                if record_history:
                    self._undo.append(self._document.model_copy(deep=True))
                    self._undo = self._undo[-100:]
                    self._redo.clear()
                self._document = next_document
                temporary_preview.replace(self.preview_path)
                self._write_document()
            finally:
                temporary_preview.unlink(missing_ok=True)
            return self.document()

    def import_file(self, filename: str, content: bytes) -> CadDocument:
        suffix = Path(filename).suffix.lower()
        if suffix not in {".step", ".stp", ".stl"}:
            raise BuildError("Supported imports are .step, .stp, and .stl")
        asset_path = self.imports / f"{uuid.uuid4().hex}{suffix}"
        asset_path.write_bytes(content)
        name = Path(filename).stem or "Imported model"
        if suffix == ".stl":
            with self._lock:
                imported = CadDocument(
                    id=f"import-{uuid.uuid4().hex[:8]}",
                    name=name,
                    revision=self._document.revision + 1,
                    features=[
                        ImportStlFeature(
                            id="imported-mesh",
                            name="Imported STL reference",
                            source_path=str(asset_path),
                        )
                    ],
                )
                self._undo.append(self._document.model_copy(deep=True))
                self._redo.clear()
                self._document = imported
                shutil.copy2(asset_path, self.preview_path)
                self._write_document()
                return self.document()
        imported = CadDocument(
            id=f"import-{uuid.uuid4().hex[:8]}",
            name=name,
            features=[
                ImportStepFeature(
                    id="imported-base",
                    name="Imported STEP base",
                    source_path=str(asset_path),
                )
            ],
        )
        return self.apply(imported)

    def undo(self) -> CadDocument:
        with self._lock:
            if not self._undo:
                raise BuildError("Nothing to undo")
            candidate = self._undo.pop()
            self._redo.append(self._document.model_copy(deep=True))
            return self.apply(candidate, record_history=False)

    def redo(self) -> CadDocument:
        with self._lock:
            if not self._redo:
                raise BuildError("Nothing to redo")
            candidate = self._redo.pop()
            self._undo.append(self._document.model_copy(deep=True))
            return self.apply(candidate, record_history=False)

    def export(self, extension: str) -> Path:
        if extension not in {"step", "stl"}:
            raise BuildError("Supported exports are STEP and STL")
        destination = self.exports / f"{self._document.id}-r{self._document.revision}.{extension}"
        export_document(self._document, destination)
        return destination

    def debug_manifest(self) -> dict[str, object]:
        return json.loads(self._document.model_dump_json())

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import shutil
import threading
import uuid
from pathlib import Path

import cadquery as cq
from platformdirs import user_data_path

from marul3d_api.build_engine import BuildError, build_document
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
        self.brep_cache = self.root / "cache" / "brep"
        self.imports.mkdir(exist_ok=True)
        self.exports.mkdir(exist_ok=True)
        self.brep_cache.mkdir(parents=True, exist_ok=True)
        self.document_path = self.root / "document.json"
        self.history_path = self.root / "history.json"
        self.preview_path = self.root / "preview.stl"
        self._lock = threading.RLock()
        self._undo: list[CadDocument] = []
        self._redo: list[CadDocument] = []
        self.last_build_stats: dict[str, int] = {
            "cache_hit_features": 0,
            "rebuilt_features": 0,
            "cache_writes": 0,
        }
        self._initial_document = (
            initial_document.model_copy(deep=True) if initial_document else None
        )
        self._document = self._load()
        self._load_history()
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

    def _load_history(self) -> None:
        if not self.history_path.exists():
            return
        try:
            payload = json.loads(self.history_path.read_text(encoding="utf-8"))
            self._undo = [CadDocument.model_validate(item) for item in payload.get("undo", [])]
            self._redo = [CadDocument.model_validate(item) for item in payload.get("redo", [])]
        except (OSError, ValueError, TypeError):
            self._undo = []
            self._redo = []

    def _write_history(self) -> None:
        temporary = self.history_path.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(
                {
                    "undo": [item.model_dump(mode="json") for item in self._undo[-100:]],
                    "redo": [item.model_dump(mode="json") for item in self._redo[-100:]],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        temporary.replace(self.history_path)

    def _ensure_preview(self) -> None:
        if self.preview_path.exists():
            return
        if any(feature.type == "import_stl" for feature in self._document.features):
            source = Path(self._document.features[0].source_path)
            if source.exists():
                shutil.copy2(source, self.preview_path)
                return
        self._export_preview_cached(self._document, self.preview_path)
        self._write_document()

    @staticmethod
    def _cadquery_version() -> str:
        try:
            return importlib.metadata.version("cadquery")
        except importlib.metadata.PackageNotFoundError:
            return "unknown"

    def _prefix_hashes(self, document: CadDocument) -> list[str]:
        seed = json.dumps(
            {
                "cache_schema": 1,
                "cadquery": self._cadquery_version(),
                "document_schema": document.schema_version,
                "units": document.units,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(seed.encode()).hexdigest()
        prefixes: list[str] = []
        for feature in document.features:
            feature_payload = feature.model_dump(mode="json")
            # A display-name edit does not change the resulting B-rep. Keep it out
            # of the geometry key so renames can reuse the complete prefix cache.
            feature_payload.pop("name", None)
            payload: dict[str, object] = {
                "previous": digest,
                "feature": feature_payload,
            }
            if isinstance(feature, (ImportStepFeature, ImportStlFeature)):
                source = Path(feature.source_path)
                try:
                    stat = source.stat()
                    payload["source"] = {
                        "size": stat.st_size,
                        "modified_ns": stat.st_mtime_ns,
                    }
                except OSError:
                    payload["source"] = {"missing": True}
            encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
            digest = hashlib.sha256(encoded.encode()).hexdigest()
            prefixes.append(digest)
        return prefixes

    def _cached_build(self, document: CadDocument) -> cq.Workplane:
        prefixes = self._prefix_hashes(document)
        initial_shape: cq.Workplane | None = None
        start_index = 0
        for index in range(len(prefixes) - 1, -1, -1):
            cache_path = self.brep_cache / f"{prefixes[index]}.brep"
            if not cache_path.exists():
                continue
            try:
                candidate = cq.importers.importBrep(str(cache_path))
                if not candidate.val().isValid():
                    raise ValueError("Cached B-rep is invalid")
                initial_shape = candidate
                start_index = index + 1
                cache_path.touch()
                break
            except (OSError, ValueError, RuntimeError):
                cache_path.unlink(missing_ok=True)

        cache_writes = 0

        def cache_feature(index: int, shape: cq.Workplane) -> None:
            nonlocal cache_writes
            cache_path = self.brep_cache / f"{prefixes[index]}.brep"
            if cache_path.exists():
                cache_path.touch()
                return
            temporary = self.brep_cache / f".{prefixes[index]}-{uuid.uuid4().hex}.tmp"
            try:
                shape.val().exportBrep(str(temporary))
                temporary.replace(cache_path)
                cache_writes += 1
            except (OSError, RuntimeError, ValueError):
                temporary.unlink(missing_ok=True)

        result = build_document(
            document,
            initial_shape=initial_shape,
            start_index=start_index,
            on_feature_built=cache_feature,
        )
        self.last_build_stats = {
            "cache_hit_features": start_index,
            "rebuilt_features": len(document.features) - start_index,
            "cache_writes": cache_writes,
        }
        self._prune_brep_cache()
        return result

    def _prune_brep_cache(self, max_entries: int = 256) -> None:
        try:
            entries = sorted(
                self.brep_cache.glob("*.brep"),
                key=lambda path: path.stat().st_mtime_ns,
                reverse=True,
            )
        except OSError:
            return
        for stale in entries[max_entries:]:
            try:
                stale.unlink(missing_ok=True)
            except OSError:
                pass

    def _export_preview_cached(self, document: CadDocument, destination: Path) -> None:
        shape = self._cached_build(document)
        cq.exporters.export(
            shape,
            str(destination),
            exportType="STL",
            tolerance=0.08,
            angularTolerance=0.12,
        )

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
                self._export_preview_cached(next_document, temporary_preview)
                if record_history:
                    self._undo.append(self._document.model_copy(deep=True))
                    self._undo = self._undo[-100:]
                    self._redo.clear()
                self._document = next_document
                temporary_preview.replace(self.preview_path)
                self._write_document()
                self._write_history()
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
                self._write_history()
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
        shape = self._cached_build(self._document)
        cq.exporters.export(shape, str(destination))
        return destination

    def debug_manifest(self) -> dict[str, object]:
        manifest = json.loads(self._document.model_dump_json())
        manifest["build_cache"] = self.last_build_stats.copy()
        return manifest

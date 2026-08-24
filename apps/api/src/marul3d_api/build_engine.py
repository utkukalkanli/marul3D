from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import cadquery as cq

from marul3d_api.models import (
    BoxFeature,
    CadDocument,
    CustomCadQueryFeature,
    CylinderFeature,
    FilletFeature,
    HolePatternFeature,
    ImportStepFeature,
    ImportStlFeature,
)


class BuildError(RuntimeError):
    pass


_FORBIDDEN_NODES = (
    ast.Import,
    ast.ImportFrom,
    ast.Global,
    ast.Nonlocal,
    ast.ClassDef,
    ast.FunctionDef,
    ast.AsyncFunctionDef,
    ast.Lambda,
    ast.With,
    ast.AsyncWith,
    ast.Try,
    ast.Raise,
)

_FORBIDDEN_NAMES = {
    "breakpoint",
    "compile",
    "eval",
    "exec",
    "globals",
    "help",
    "input",
    "locals",
    "open",
    "os",
    "pathlib",
    "socket",
    "subprocess",
    "sys",
    "type",
    "vars",
}


def validate_custom_source(source: str) -> None:
    if len(source) > 50_000:
        raise BuildError("Custom CadQuery source exceeds 50 KB")
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError as exc:
        raise BuildError(f"Custom CadQuery syntax error: {exc.msg}") from exc

    assigns_result = False
    for node in ast.walk(tree):
        if isinstance(node, _FORBIDDEN_NODES):
            raise BuildError(f"Custom CadQuery cannot use {type(node).__name__}")
        if isinstance(node, ast.Name):
            if node.id in _FORBIDDEN_NAMES or node.id.startswith("__"):
                raise BuildError(f"Custom CadQuery cannot access {node.id!r}")
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise BuildError("Custom CadQuery cannot access private attributes")
        if isinstance(node, ast.Assign):
            assigns_result = assigns_result or any(
                isinstance(target, ast.Name) and target.id == "result" for target in node.targets
            )
    if not assigns_result:
        raise BuildError("Custom CadQuery source must assign `result`")


def _apply_boolean(
    current: cq.Workplane | None,
    tool: cq.Workplane,
    operation: str,
) -> cq.Workplane:
    if operation == "new":
        return tool
    if current is None:
        raise BuildError(f"Operation {operation!r} requires an existing solid")
    if operation == "add":
        return current.union(tool)
    if operation == "cut":
        return current.cut(tool)
    raise BuildError(f"Unsupported boolean operation: {operation}")


def _apply_hole_pattern(
    current: cq.Workplane,
    feature: HolePatternFeature,
) -> cq.Workplane:
    """Cut global -Z holes without requiring a planar support face.

    Attaching a workplane to ``faces(">Z")`` fails when the upper face is
    spherical or otherwise curved. Explicit cutting cylinders preserve the
    feature's global XY point semantics and work for both planar and curved
    bodies.
    """
    bounds = current.val().BoundingBox()
    margin = max(1.0, feature.diameter, bounds.zlen * 0.05)
    start_z = bounds.zmax + margin
    cut_depth = (
        bounds.zlen + 2.0 * margin
        if feature.depth is None
        else feature.depth + margin
    )

    for point in feature.points:
        tool = (
            cq.Workplane("XY", origin=(point.x, point.y, start_z))
            .circle(feature.diameter / 2.0)
            .extrude(-cut_depth)
        )
        before_volume = current.val().Volume()
        candidate = current.cut(tool)
        removed_volume = before_volume - candidate.val().Volume()
        tolerance = max(1e-7, before_volume * 1e-10)
        if removed_volume <= tolerance:
            raise BuildError(
                f"Hole at ({point.x:g}, {point.y:g}) does not intersect the current "
                "solid; move the point inside the body's XY footprint"
            )
        current = candidate
    return current


def _run_custom_feature(
    feature: CustomCadQueryFeature,
    current: cq.Workplane | None,
    work_dir: Path,
) -> cq.Workplane:
    validate_custom_source(feature.source)
    payload = {
        "source": feature.source,
        "parameters": {item.name: item.value for item in feature.parameters},
        "base_step": None,
        "output_step": str(work_dir / f"{feature.id}-result.step"),
    }
    if current is not None:
        base_path = work_dir / f"{feature.id}-base.step"
        cq.exporters.export(current, str(base_path))
        payload["base_step"] = str(base_path)

    payload_path = work_dir / f"{feature.id}-payload.json"
    payload_path.write_text(json.dumps(payload), encoding="utf-8")
    env = os.environ.copy()
    env["PYTHONNOUSERSITE"] = "1"
    try:
        completed = subprocess.run(
            [sys.executable, "-m", "marul3d_api.custom_worker", str(payload_path)],
            cwd=work_dir,
            env=env,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise BuildError("Custom CadQuery execution exceeded 15 seconds") from exc
    if completed.returncode != 0:
        detail = completed.stderr.strip().splitlines()[-1] if completed.stderr.strip() else "failed"
        raise BuildError(f"Custom CadQuery execution failed: {detail}")
    return cq.importers.importStep(payload["output_step"])


def build_document(document: CadDocument) -> cq.Workplane:
    current: cq.Workplane | None = None
    with tempfile.TemporaryDirectory(prefix="marul3d-build-") as temporary:
        work_dir = Path(temporary)
        for feature in document.features:
            if not feature.enabled:
                continue
            try:
                if isinstance(feature, BoxFeature):
                    tool = cq.Workplane(
                        "XY", origin=(feature.x, feature.y, feature.z)
                    ).box(
                        feature.width,
                        feature.depth,
                        feature.height,
                        centered=(True, True, False),
                    )
                    current = _apply_boolean(current, tool, feature.operation)
                elif isinstance(feature, CylinderFeature):
                    tool = cq.Workplane(
                        "XY", origin=(feature.x, feature.y, feature.z)
                    ).circle(feature.radius).extrude(feature.height)
                    current = _apply_boolean(current, tool, feature.operation)
                elif isinstance(feature, HolePatternFeature):
                    if current is None:
                        raise BuildError("A hole pattern requires an existing solid")
                    current = _apply_hole_pattern(current, feature)
                elif isinstance(feature, FilletFeature):
                    if current is None:
                        raise BuildError("A fillet requires an existing solid")
                    edges = (
                        current.edges("|Z")
                        if feature.selector == "vertical"
                        else current.edges()
                    )
                    current = edges.fillet(feature.radius)
                elif isinstance(feature, ImportStepFeature):
                    current = cq.importers.importStep(feature.source_path)
                elif isinstance(feature, ImportStlFeature):
                    if len(document.features) > 1:
                        raise BuildError("STL reference meshes cannot receive B-rep features")
                elif isinstance(feature, CustomCadQueryFeature):
                    current = _run_custom_feature(feature, current, work_dir)
            except BuildError:
                raise
            except Exception as exc:
                raise BuildError(f"Feature {feature.name!r} failed: {exc}") from exc

        if current is None:
            raise BuildError("The document does not contain a buildable solid")
        try:
            if not current.val().isValid():
                raise BuildError("OpenCascade reported an invalid result")
        except AttributeError as exc:
            raise BuildError("The document result is not a valid CadQuery shape") from exc
        return current


def export_preview(document: CadDocument, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shape = build_document(document)
    cq.exporters.export(
        shape,
        str(destination),
        exportType="STL",
        tolerance=0.08,
        angularTolerance=0.12,
    )


def export_document(document: CadDocument, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shape = build_document(document)
    cq.exporters.export(shape, str(destination))

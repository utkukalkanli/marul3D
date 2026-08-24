from pathlib import Path

from marul3d_api.build_engine import (
    BuildError,
    build_document,
    export_preview,
    validate_custom_source,
)
from marul3d_api.models import (
    CadDocument,
    CustomCadQueryFeature,
    ExtrudeFeature,
    HolePatternFeature,
    Point2D,
    SketchFeature,
    sample_document,
)


def test_sample_document_builds_stl(tmp_path: Path) -> None:
    destination = tmp_path / "preview.stl"
    export_preview(sample_document(), destination)
    assert destination.exists()
    assert destination.stat().st_size > 500


def test_custom_source_validation() -> None:
    validate_custom_source("result = cq.Workplane('XY').box(10, 10, 10)")


def test_custom_feature_builds_in_worker(tmp_path: Path) -> None:
    document = CadDocument(
        id="custom-part",
        name="Custom part",
        features=[
            CustomCadQueryFeature(
                id="custom-body",
                name="Custom body",
                source="result = cq.Workplane('XY').box(12, 8, 4)",
            )
        ],
    )
    destination = tmp_path / "custom.stl"
    export_preview(document, destination)
    assert destination.stat().st_size > 500


def test_hole_pattern_cuts_a_spherical_body() -> None:
    document = CadDocument(
        id="spherical-part",
        name="Spherical part with mounting holes",
        features=[
            CustomCadQueryFeature(
                id="sphere",
                name="Spherical body",
                source="result = cq.Workplane('XY').sphere(40)",
            ),
            HolePatternFeature(
                id="mounting-holes",
                name="Mounting holes",
                diameter=12,
                points=[Point2D(x=-18, y=0), Point2D(x=18, y=0)],
            ),
        ],
    )

    result = build_document(document)

    assert result.val().isValid()
    assert result.faces().size() > 1


def test_hole_pattern_reports_points_outside_the_solid() -> None:
    document = CadDocument(
        id="invalid-holes",
        features=[
            CustomCadQueryFeature(
                id="sphere",
                name="Spherical body",
                source="result = cq.Workplane('XY').sphere(20)",
            ),
            HolePatternFeature(
                id="mounting-holes",
                name="Mounting holes",
                diameter=6,
                points=[Point2D(x=50, y=50)],
            ),
        ],
    )

    try:
        build_document(document)
    except BuildError as exc:
        assert "does not intersect" in str(exc)
    else:
        raise AssertionError("Expected an invalid hole point to fail")


def test_sketch_extrude_and_hole_build_a_parametric_part() -> None:
    document = CadDocument(
        id="parametric-part",
        features=[
            SketchFeature(
                id="base-sketch",
                name="Base sketch",
                profile="rectangle",
                width=40,
                height=24,
            ),
            ExtrudeFeature(
                id="base-extrude",
                name="Base extrude",
                sketch_id="base-sketch",
                depends_on=["base-sketch"],
                distance=8,
            ),
            HolePatternFeature(
                id="center-hole",
                name="Center hole",
                depends_on=["base-extrude"],
                diameter=5,
                points=[Point2D(x=0, y=0)],
            ),
        ],
    )

    result = build_document(document)

    assert result.val().isValid()
    assert result.val().Volume() < 40 * 24 * 8
    assert result.faces().size() > 6


def test_dependency_must_appear_before_child() -> None:
    document = CadDocument(
        features=[
            ExtrudeFeature(
                id="extrude",
                name="Extrude",
                sketch_id="sketch",
                distance=8,
            ),
            SketchFeature(id="sketch", name="Sketch"),
        ]
    )

    try:
        build_document(document)
    except BuildError as exc:
        assert "must appear after" in str(exc)
    else:
        raise AssertionError("Expected invalid dependency order to fail")


def test_enabled_child_rejects_suppressed_parent() -> None:
    document = CadDocument(
        features=[
            SketchFeature(id="sketch", name="Sketch", enabled=False),
            ExtrudeFeature(
                id="extrude",
                name="Extrude",
                sketch_id="sketch",
                depends_on=["sketch"],
                distance=8,
            ),
        ]
    )

    try:
        build_document(document)
    except BuildError as exc:
        assert "suppressed" in str(exc)
    else:
        raise AssertionError("Expected suppressed dependency to fail")

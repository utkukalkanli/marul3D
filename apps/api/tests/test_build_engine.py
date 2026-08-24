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
    HolePatternFeature,
    Point2D,
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

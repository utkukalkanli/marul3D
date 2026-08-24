from pathlib import Path

from marul3d_api.build_engine import export_preview, validate_custom_source
from marul3d_api.models import CadDocument, CustomCadQueryFeature, sample_document


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

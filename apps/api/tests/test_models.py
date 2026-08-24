from marul3d_api.models import CadDocument, sample_document


def test_sample_document_round_trips() -> None:
    document = sample_document()
    restored = CadDocument.model_validate_json(document.model_dump_json())
    assert restored == document
    assert [feature.type for feature in restored.features] == ["box", "hole_pattern", "fillet"]

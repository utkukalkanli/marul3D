from marul3d_api.models import CadDocument, CadProposal, sample_document


def test_sample_document_round_trips() -> None:
    document = sample_document()
    restored = CadDocument.model_validate_json(document.model_dump_json())
    assert restored == document
    assert [feature.type for feature in restored.features] == ["box", "hole_pattern", "fillet"]


def test_proposal_schema_uses_supported_feature_union() -> None:
    schema = CadProposal.model_json_schema()
    feature_items = schema["$defs"]["CadDocument"]["properties"]["features"]["items"]

    assert "anyOf" in feature_items
    assert "oneOf" not in feature_items

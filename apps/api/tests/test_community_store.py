from pathlib import Path

import pytest

from marul3d_api.community_store import CommunityError, CommunityStore
from marul3d_api.models import CommunityListingCreateRequest


def draft_request() -> CommunityListingCreateRequest:
    return CommunityListingCreateRequest(
        name="Mounting plate kit",
        description="A configurable mounting plate prepared for local fabrication.",
        category="Mechanical",
        price_cents=1200,
        currency="EUR",
        license="commercial",
        tags=["mount", "plate"],
        workspace_id="workspace-1",
        project_id="project-1",
        object_id="object-1",
    )


def test_catalog_filters_data_and_persists_local_drafts(tmp_path: Path) -> None:
    store = CommunityStore(tmp_path)
    initial = store.catalog()
    assert initial.commerce_enabled is False
    assert "Mechanical" in initial.categories
    assert any(listing.price_cents == 0 for listing in initial.listings)
    assert any(listing.price_cents > 0 for listing in initial.listings)

    updated = store.create_draft(draft_request(), "Starter mounting plate")
    draft = updated.listings[0]
    assert draft.status == "draft"
    assert draft.source_object_name == "Starter mounting plate"
    assert draft.creator == "You"

    restored = CommunityStore(tmp_path).catalog()
    assert restored.listings[0].id == draft.id
    assert "workspace-1" not in (tmp_path / "community.json").read_text()

    after_delete = store.delete_draft(draft.id)
    assert all(listing.id != draft.id for listing in after_delete.listings)


def test_only_local_drafts_can_be_deleted(tmp_path: Path) -> None:
    store = CommunityStore(tmp_path)
    with pytest.raises(CommunityError):
        store.delete_draft("community-robot-gripper")

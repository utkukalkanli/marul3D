from __future__ import annotations

import os
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path

from platformdirs import user_data_path
from pydantic import BaseModel, Field

from marul3d_api.models import (
    CommunityCatalogResponse,
    CommunityListing,
    CommunityListingCreateRequest,
)


class CommunityError(RuntimeError):
    pass


class _CommunityState(BaseModel):
    schema_version: int = 1
    drafts: list[CommunityListing] = Field(default_factory=list)


CATEGORIES = [
    "Mechanical",
    "Robotics",
    "Enclosures",
    "Architecture",
    "Aerospace",
    "Fixtures",
]


FEATURED_LISTINGS = [
    CommunityListing(
        id="community-planetary-gearbox",
        name="Compact Planetary Gearbox",
        description=(
            "A configurable three-stage gearbox assembly prepared for prototyping "
            "and motion studies."
        ),
        creator="Mechanica Labs",
        category="Mechanical",
        price_cents=2400,
        license="commercial",
        formats=["STEP", "STL"],
        tags=["gearbox", "parametric", "assembly"],
        rating=4.9,
        review_count=86,
        featured=True,
        created_at="2026-07-18T10:00:00+00:00",
    ),
    CommunityListing(
        id="community-robot-gripper",
        name="Adaptive Robot Gripper",
        description=(
            "Two-finger robot gripper concept with replaceable fingertips and "
            "mounting patterns."
        ),
        creator="Kinetic Forge",
        category="Robotics",
        price_cents=0,
        license="open",
        formats=["STEP", "STL"],
        tags=["robotics", "gripper", "automation"],
        rating=4.8,
        review_count=142,
        featured=True,
        created_at="2026-06-03T10:00:00+00:00",
    ),
    CommunityListing(
        id="community-sensor-enclosure",
        name="IP54 Sensor Enclosure",
        description=(
            "Compact electronics housing with gasket channel, mounting bosses, "
            "and cable gland entry."
        ),
        creator="Object Works",
        category="Enclosures",
        price_cents=900,
        license="commercial",
        formats=["STEP", "STL"],
        tags=["enclosure", "electronics", "printable"],
        rating=4.7,
        review_count=58,
        created_at="2026-05-22T10:00:00+00:00",
    ),
    CommunityListing(
        id="community-camera-bracket",
        name="Adjustable Camera Bracket",
        description=(
            "A compact tilt bracket with a standard tripod interface and printable "
            "hardware knobs."
        ),
        creator="Freeform Studio",
        category="Fixtures",
        price_cents=0,
        license="open",
        formats=["STEP", "STL"],
        tags=["camera", "bracket", "fixture"],
        rating=4.6,
        review_count=211,
        created_at="2026-04-12T10:00:00+00:00",
    ),
    CommunityListing(
        id="community-drone-frame",
        name="Cinewhoop Drone Frame",
        description=(
            "Ducted micro-drone frame study with replaceable arms and protected "
            "camera mounting."
        ),
        creator="Aero Nodes",
        category="Aerospace",
        price_cents=1600,
        license="personal",
        formats=["STEP", "STL", "GLB"],
        tags=["drone", "frame", "aerospace"],
        rating=4.9,
        review_count=73,
        created_at="2026-03-30T10:00:00+00:00",
    ),
    CommunityListing(
        id="community-pavilion-node",
        name="Parametric Pavilion Node",
        description=(
            "Adjustable timber junction for generative pavilion studies and "
            "scale-model fabrication."
        ),
        creator="Common Geometry",
        category="Architecture",
        price_cents=1200,
        license="commercial",
        formats=["STEP", "STL"],
        tags=["architecture", "node", "parametric"],
        rating=4.5,
        review_count=39,
        created_at="2026-02-08T10:00:00+00:00",
    ),
]


class CommunityStore:
    """Local catalog cache and seller drafts; no payments or remote publishing."""

    def __init__(self, root: Path | None = None) -> None:
        configured = os.getenv("MARUL3D_DATA_DIR")
        self.root = root or (Path(configured) if configured else user_data_path("marul3D"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "community.json"
        self._lock = threading.RLock()
        self._state = self._load()

    def _load(self) -> _CommunityState:
        if not self.path.exists():
            return _CommunityState()
        try:
            return _CommunityState.model_validate_json(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return _CommunityState()

    def _write(self) -> None:
        temporary = self.path.with_suffix(".json.tmp")
        temporary.write_text(self._state.model_dump_json(indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def catalog(self) -> CommunityCatalogResponse:
        with self._lock:
            return CommunityCatalogResponse(
                categories=CATEGORIES,
                listings=[*self._state.drafts, *FEATURED_LISTINGS],
                commerce_enabled=False,
            )

    def create_draft(
        self,
        request: CommunityListingCreateRequest,
        source_object_name: str,
    ) -> CommunityCatalogResponse:
        listing = CommunityListing(
            id=f"draft-{uuid.uuid4().hex[:10]}",
            name=request.name.strip(),
            description=request.description.strip(),
            creator="You",
            category=request.category,
            price_cents=request.price_cents,
            currency=request.currency,
            license=request.license,
            formats=["STEP", "STL"],
            tags=[tag.strip() for tag in request.tags if tag.strip()],
            status="draft",
            source_object_name=source_object_name,
            created_at=datetime.now(UTC).isoformat(),
        )
        with self._lock:
            self._state.drafts.insert(0, listing)
            self._write()
        return self.catalog()

    def delete_draft(self, listing_id: str) -> CommunityCatalogResponse:
        with self._lock:
            listing = next(
                (item for item in self._state.drafts if item.id == listing_id), None
            )
            if listing is None:
                raise CommunityError("Community draft not found")
            self._state.drafts.remove(listing)
            self._write()
        return self.catalog()

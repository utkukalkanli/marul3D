from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point2D(StrictModel):
    x: float
    y: float


class NamedParameter(StrictModel):
    name: str
    value: float
    unit: str = "mm"


class FeatureBase(StrictModel):
    id: str
    name: str
    enabled: bool = True
    depends_on: list[str] = Field(default_factory=list)


class SketchFeature(FeatureBase):
    type: Literal["sketch"] = "sketch"
    plane: Literal["XY", "XZ", "YZ"] = "XY"
    profile: Literal["rectangle", "circle"] = "rectangle"
    width: float = Field(default=40, gt=0)
    height: float = Field(default=24, gt=0)
    radius: float = Field(default=12, gt=0)
    origin_x: float = 0
    origin_y: float = 0
    origin_z: float = 0


class ExtrudeFeature(FeatureBase):
    type: Literal["extrude"] = "extrude"
    sketch_id: str
    distance: float = Field(default=10, gt=0)
    operation: Literal["new", "add", "cut"] = "new"
    symmetric: bool = False


class BoxFeature(FeatureBase):
    type: Literal["box"] = "box"
    width: float = Field(gt=0)
    depth: float = Field(gt=0)
    height: float = Field(gt=0)
    x: float = 0
    y: float = 0
    z: float = 0
    operation: Literal["new", "add", "cut"] = "new"


class CylinderFeature(FeatureBase):
    type: Literal["cylinder"] = "cylinder"
    radius: float = Field(gt=0)
    height: float = Field(gt=0)
    x: float = 0
    y: float = 0
    z: float = 0
    operation: Literal["new", "add", "cut"] = "add"


class HolePatternFeature(FeatureBase):
    type: Literal["hole_pattern"] = "hole_pattern"
    diameter: float = Field(gt=0)
    points: list[Point2D] = Field(min_length=1)
    depth: float | None = Field(default=None, gt=0)


class FilletFeature(FeatureBase):
    type: Literal["fillet"] = "fillet"
    radius: float = Field(gt=0)
    selector: Literal["vertical", "all"] = "vertical"


class ImportStepFeature(FeatureBase):
    type: Literal["import_step"] = "import_step"
    source_path: str


class ImportStlFeature(FeatureBase):
    type: Literal["import_stl"] = "import_stl"
    source_path: str


class CustomCadQueryFeature(FeatureBase):
    type: Literal["custom_cadquery"] = "custom_cadquery"
    source: str
    parameters: list[NamedParameter] = Field(default_factory=list)


Feature = (
    SketchFeature
    | ExtrudeFeature
    | BoxFeature
    | CylinderFeature
    | HolePatternFeature
    | FilletFeature
    | ImportStepFeature
    | ImportStlFeature
    | CustomCadQueryFeature
)


class CadDocument(StrictModel):
    schema_version: Literal[1] = 1
    id: str = "untitled"
    name: str = "Untitled Part"
    units: Literal["mm"] = "mm"
    revision: int = 0
    features: list[Feature] = Field(default_factory=list)


class CadProposal(StrictModel):
    summary: str
    document: CadDocument


class GenerateRequest(StrictModel):
    prompt: str = Field(min_length=1, max_length=20_000)
    provider: Literal["openai"] = "openai"
    model: str = "gpt-5.6"


class CredentialRequest(StrictModel):
    provider: Literal["openai"] = "openai"
    api_key: str = Field(min_length=8, max_length=512)


class ProviderStatus(StrictModel):
    provider: str
    configured: bool
    storage: Literal["keychain", "environment", "unavailable"]


class ExtensionPermission(StrictModel):
    id: str
    label: str
    description: str


class MarketplaceExtension(StrictModel):
    id: str
    name: str
    publisher: str
    description: str
    version: str
    category: str
    tags: list[str]
    capabilities: list[str]
    permissions: list[ExtensionPermission]
    featured: bool = False
    verified: bool = False
    installed: bool = False
    enabled: bool = False
    authenticated: bool = False
    endpoint: str | None = None


class ExtensionCatalogResponse(StrictModel):
    extensions: list[MarketplaceExtension]


class ExtensionEnableRequest(StrictModel):
    enabled: bool


class TrellisConnectionRequest(StrictModel):
    endpoint: str = Field(min_length=8, max_length=2048)
    api_token: str = Field(min_length=8, max_length=2048)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        endpoint = value.strip().rstrip("/")
        parsed = urlsplit(endpoint)
        if parsed.query or parsed.fragment or not parsed.hostname:
            raise ValueError("Endpoint cannot contain a query or fragment")
        if parsed.scheme == "https":
            return endpoint
        if parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost", "::1"}:
            return endpoint
        raise ValueError("Use an HTTPS endpoint or a loopback HTTP endpoint")


CommunityCategory = Literal[
    "Mechanical",
    "Robotics",
    "Enclosures",
    "Architecture",
    "Aerospace",
    "Fixtures",
]


class CommunityListing(StrictModel):
    id: str
    name: str
    description: str
    creator: str
    category: CommunityCategory
    price_cents: int = Field(ge=0)
    currency: Literal["EUR", "USD"] = "EUR"
    license: Literal["personal", "commercial", "open"] = "personal"
    formats: list[Literal["STEP", "STL", "GLB"]]
    tags: list[str] = Field(default_factory=list)
    rating: float = Field(default=0, ge=0, le=5)
    review_count: int = Field(default=0, ge=0)
    featured: bool = False
    status: Literal["published", "draft"] = "published"
    source_object_name: str | None = None
    created_at: str


class CommunityCatalogResponse(StrictModel):
    categories: list[CommunityCategory]
    listings: list[CommunityListing]
    commerce_enabled: bool = False


class CommunityListingCreateRequest(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    category: CommunityCategory
    price_cents: int = Field(ge=0, le=10_000_000)
    currency: Literal["EUR", "USD"] = "EUR"
    license: Literal["personal", "commercial", "open"] = "personal"
    tags: list[str] = Field(default_factory=list, max_length=8)
    workspace_id: str
    project_id: str
    object_id: str


class ScanAsset(StrictModel):
    id: str
    name: str
    status: Literal["ready", "processing", "failed"]
    captured_at: str
    source_device: str
    image_count: int = Field(ge=0)
    progress: int = Field(ge=0, le=100)
    quality: Literal["draft", "standard", "high"]
    triangle_count: int = Field(ge=0)
    dimensions_mm: list[float] = Field(min_length=3, max_length=3)
    size_mb: float = Field(ge=0)
    storage: Literal["demo", "local", "cloud"] = "demo"


class ScanCatalogResponse(StrictModel):
    scans: list[ScanAsset]
    account_mode: Literal["local", "synced"] = "local"


class ScanCopyRequest(StrictModel):
    workspace_id: str
    project_id: str
    object_name: str = Field(min_length=1, max_length=120)


class AgentPromptRequest(StrictModel):
    prompt: str = Field(min_length=1, max_length=20_000)
    provider: Literal["openai"] = "openai"
    model: str = "gpt-5.6"


class AgentMessage(StrictModel):
    id: str
    role: Literal["user", "assistant"]
    text: str
    kind: Literal["message", "clarification", "proposal", "error"] = "message"
    options: list[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class AgentToolEvent(StrictModel):
    id: str
    tool: str
    label: str
    status: Literal["running", "completed", "failed", "awaiting_approval"]
    detail: str | None = None


class FeatureDiff(StrictModel):
    added: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    modified: list[str] = Field(default_factory=list)


class AgentProposal(StrictModel):
    id: str
    summary: str
    document: CadDocument
    diff: FeatureDiff
    status: Literal["draft", "validating", "invalid", "ready", "applied", "discarded"] = "draft"
    error: str | None = None
    build_attempts: int = 0


class AgentConversation(StrictModel):
    schema_version: Literal[1] = 1
    runtime: Literal["opencode"] = "opencode"
    opencode_session_id: str | None = None
    messages: list[AgentMessage] = Field(default_factory=list)
    tool_events: list[AgentToolEvent] = Field(default_factory=list)
    proposal: AgentProposal | None = None


class BuildResponse(StrictModel):
    document: CadDocument
    preview_revision: int
    summary: str | None = None


class AgentApplyResponse(StrictModel):
    build: BuildResponse
    conversation: AgentConversation


class EntityNameRequest(StrictModel):
    name: str = Field(min_length=1, max_length=120)


class CadObjectSummary(StrictModel):
    id: str
    name: str
    revision: int


class ProjectSummary(StrictModel):
    id: str
    name: str
    objects: list[CadObjectSummary]


class WorkspaceSummary(StrictModel):
    id: str
    name: str
    projects: list[ProjectSummary]


class HierarchyResponse(StrictModel):
    workspaces: list[WorkspaceSummary]
    selected_workspace_id: str | None = None
    selected_project_id: str | None = None
    selected_object_id: str | None = None


class ScanCopyResponse(StrictModel):
    hierarchy: HierarchyResponse
    object_id: str


def sample_document() -> CadDocument:
    return CadDocument(
        id="starter-part",
        name="Starter mounting plate",
        features=[
            BoxFeature(
                id="base-plate",
                name="Base plate",
                width=50,
                depth=30,
                height=5,
            ),
            HolePatternFeature(
                id="mounting-holes",
                name="Mounting holes",
                depends_on=["base-plate"],
                diameter=4,
                points=[
                    Point2D(x=-20, y=-10),
                    Point2D(x=20, y=-10),
                    Point2D(x=20, y=10),
                    Point2D(x=-20, y=10),
                ],
            ),
            FilletFeature(
                id="edge-fillet",
                name="Edge fillet",
                depends_on=["mounting-holes"],
                radius=1.5,
                selector="vertical",
            ),
        ],
    )

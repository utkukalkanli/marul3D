from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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

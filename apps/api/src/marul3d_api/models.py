from __future__ import annotations

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
    points: list[Point2D]
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
    BoxFeature
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


class BuildResponse(StrictModel):
    document: CadDocument
    preview_revision: int
    summary: str | None = None


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
                radius=1.5,
                selector="vertical",
            ),
        ],
    )

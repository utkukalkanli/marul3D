export type Point2D = { x: number; y: number };
export type NamedParameter = { name: string; value: number; unit: string };

type FeatureBase = {
  id: string;
  name: string;
  enabled: boolean;
};

export type BoxFeature = FeatureBase & {
  type: "box";
  width: number;
  depth: number;
  height: number;
  x: number;
  y: number;
  z: number;
  operation: "new" | "add" | "cut";
};

export type CylinderFeature = FeatureBase & {
  type: "cylinder";
  radius: number;
  height: number;
  x: number;
  y: number;
  z: number;
  operation: "new" | "add" | "cut";
};

export type HolePatternFeature = FeatureBase & {
  type: "hole_pattern";
  diameter: number;
  points: Point2D[];
  depth: number | null;
};

export type FilletFeature = FeatureBase & {
  type: "fillet";
  radius: number;
  selector: "vertical" | "all";
};

export type ImportFeature = FeatureBase & {
  type: "import_step" | "import_stl";
  source_path: string;
};

export type CustomFeature = FeatureBase & {
  type: "custom_cadquery";
  source: string;
  parameters: NamedParameter[];
};

export type Feature =
  | BoxFeature
  | CylinderFeature
  | HolePatternFeature
  | FilletFeature
  | ImportFeature
  | CustomFeature;

export type CadDocument = {
  schema_version: 1;
  id: string;
  name: string;
  units: "mm";
  revision: number;
  features: Feature[];
};

export type BuildResponse = {
  document: CadDocument;
  preview_revision: number;
  summary: string | null;
};

export type ProviderStatus = {
  provider: string;
  configured: boolean;
  storage: "keychain" | "environment" | "unavailable";
};

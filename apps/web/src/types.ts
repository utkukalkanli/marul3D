export type Point2D = { x: number; y: number };
export type NamedParameter = { name: string; value: number; unit: string };
export type DisplayUnit = "mm" | "cm" | "inch";

type FeatureBase = {
  id: string;
  name: string;
  enabled: boolean;
  depends_on: string[];
};

export type SketchFeature = FeatureBase & {
  type: "sketch";
  plane: "XY" | "XZ" | "YZ";
  profile: "rectangle" | "circle";
  width: number;
  height: number;
  radius: number;
  origin_x: number;
  origin_y: number;
  origin_z: number;
};

export type ExtrudeFeature = FeatureBase & {
  type: "extrude";
  sketch_id: string;
  distance: number;
  operation: "new" | "add" | "cut";
  symmetric: boolean;
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
  | SketchFeature
  | ExtrudeFeature
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

export type CadObjectSummary = {
  id: string;
  name: string;
  revision: number;
};

export type ProjectSummary = {
  id: string;
  name: string;
  objects: CadObjectSummary[];
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  projects: ProjectSummary[];
};

export type HierarchyResponse = {
  workspaces: WorkspaceSummary[];
  selected_workspace_id: string | null;
  selected_project_id: string | null;
  selected_object_id: string | null;
};

export type ObjectRef = {
  workspaceId: string;
  projectId: string;
  objectId: string;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  kind: "message" | "clarification" | "proposal" | "error";
  options: string[];
  created_at: string;
};

export type AgentToolEvent = {
  id: string;
  tool: string;
  label: string;
  status: "running" | "completed" | "failed" | "awaiting_approval";
  detail: string | null;
};

export type FeatureDiff = {
  added: string[];
  removed: string[];
  modified: string[];
};

export type AgentProposal = {
  id: string;
  summary: string;
  document: CadDocument;
  diff: FeatureDiff;
  status: "draft" | "validating" | "invalid" | "ready" | "applied" | "discarded";
  error: string | null;
  build_attempts: number;
};

export type AgentConversation = {
  schema_version: 1;
  runtime: "opencode";
  opencode_session_id: string | null;
  messages: AgentMessage[];
  tool_events: AgentToolEvent[];
  proposal: AgentProposal | null;
};

export type AgentApplyResponse = {
  build: BuildResponse;
  conversation: AgentConversation;
};

export type AgentStreamEvent =
  | { event: "conversation"; data: AgentConversation }
  | { event: "tool"; data: AgentToolEvent }
  | { event: "proposal"; data: AgentProposal }
  | { event: "delta"; data: { message_id: string; text: string } }
  | { event: "error"; data: { detail: string } }
  | { event: "done"; data: Record<string, never> };

export type ExtensionPermission = {
  id: string;
  label: string;
  description: string;
};

export type MarketplaceExtension = {
  id: string;
  name: string;
  publisher: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  capabilities: string[];
  permissions: ExtensionPermission[];
  featured: boolean;
  verified: boolean;
  installed: boolean;
  enabled: boolean;
  authenticated: boolean;
  endpoint: string | null;
};

export type ExtensionCatalogResponse = {
  extensions: MarketplaceExtension[];
};

export type CommunityCategory =
  | "Mechanical"
  | "Robotics"
  | "Enclosures"
  | "Architecture"
  | "Aerospace"
  | "Fixtures";

export type CommunityListing = {
  id: string;
  name: string;
  description: string;
  creator: string;
  category: CommunityCategory;
  price_cents: number;
  currency: "EUR" | "USD";
  license: "personal" | "commercial" | "open";
  formats: ("STEP" | "STL" | "GLB")[];
  tags: string[];
  rating: number;
  review_count: number;
  featured: boolean;
  status: "published" | "draft";
  source_object_name: string | null;
  created_at: string;
};

export type CommunityCatalogResponse = {
  categories: CommunityCategory[];
  listings: CommunityListing[];
  commerce_enabled: boolean;
};

export type CommunityListingDraft = {
  name: string;
  description: string;
  category: CommunityCategory;
  price_cents: number;
  currency: "EUR" | "USD";
  license: "personal" | "commercial" | "open";
  tags: string[];
};

export type ScanAsset = {
  id: string;
  name: string;
  status: "ready" | "processing" | "failed";
  captured_at: string;
  source_device: string;
  image_count: number;
  progress: number;
  quality: "draft" | "standard" | "high";
  triangle_count: number;
  dimensions_mm: [number, number, number];
  size_mb: number;
  storage: "demo" | "local" | "cloud";
};

export type ScanCatalogResponse = {
  scans: ScanAsset[];
  account_mode: "local" | "synced";
};

export type ScanCopyResponse = {
  hierarchy: HierarchyResponse;
  object_id: string;
};

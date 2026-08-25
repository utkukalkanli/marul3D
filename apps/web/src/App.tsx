import {
  Box,
  Blocks,
  Columns2,
  Download,
  FileUp,
  LayoutGrid,
  Layers3,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minimize2,
  PanelLeftOpen,
  PanelRightOpen,
  Settings,
  ScanLine,
  Store,
} from "lucide-react";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "./api";
import { CadViewport } from "./components/CadViewport";
import { AgentPanel } from "./components/AgentPanel";
import { EditorSidebar } from "./components/EditorSidebar";
import { EntityDialog, type EntityDialogRequest } from "./components/EntityDialog";
import { FeatureDialog } from "./components/FeatureDialog";
import { Inspector } from "./components/Inspector";
import { LibraryBrowser } from "./components/LibraryBrowser";
import { MarketplaceBrowser } from "./components/MarketplaceBrowser";
import { CommunityBrowser } from "./components/CommunityBrowser";
import { ScansBrowser } from "./components/ScansBrowser";
import {
  SettingsDialog,
  type ThemeId,
  type ThemePreference,
} from "./components/SettingsDialog";
import type {
  BuildResponse,
  AgentConversation,
  CadDocument,
  CommunityCategory,
  CommunityListing,
  CommunityListingDraft,
  DisplayUnit,
  Feature,
  HierarchyResponse,
  MarketplaceExtension,
  ObjectRef,
  ScanAsset,
} from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function selectedRef(hierarchy: HierarchyResponse): ObjectRef | null {
  if (
    !hierarchy.selected_workspace_id ||
    !hierarchy.selected_project_id ||
    !hierarchy.selected_object_id
  ) {
    return null;
  }
  return {
    workspaceId: hierarchy.selected_workspace_id,
    projectId: hierarchy.selected_project_id,
    objectId: hierarchy.selected_object_id,
  };
}

function savedDisplayUnit(): DisplayUnit {
  try {
    const saved = window.localStorage?.getItem("marul3d.displayUnit");
    return saved === "cm" || saved === "inch" ? saved : "mm";
  } catch {
    return "mm";
  }
}

function savedThemePreference(): ThemePreference {
  try {
    const saved = window.localStorage?.getItem("marul3d.theme");
    return saved === "adaptive" || saved === "cyberpunk" || saved === "aerospace" || saved === "kawaii"
      ? saved
      : "marul";
  } catch {
    return "marul";
  }
}

function adaptiveTheme(context: string): ThemeId {
  const normalized = context.toLocaleLowerCase();
  if (/labubu|kawaii|cute|toy|character|figurine|plush|doll|chibi/.test(normalized)) return "kawaii";
  if (/aero|aircraft|airplane|aviation|flight|wing|turbine|drone|uav|rocket|spacecraft/.test(normalized)) return "aerospace";
  if (/cyber|robot|mech|neon|sci.?fi|futur|android|drone/.test(normalized)) return "cyberpunk";
  return "marul";
}

function featureDependencies(feature: Feature): string[] {
  return feature.type === "extrude"
    ? [...new Set([...(feature.depends_on ?? []), feature.sketch_id])]
    : feature.depends_on ?? [];
}

function descendantIds(features: Feature[], rootId: string): Set<string> {
  const descendants = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const feature of features) {
      if (!descendants.has(feature.id) && featureDependencies(feature).some((id) => descendants.has(id))) {
        descendants.add(feature.id);
        changed = true;
      }
    }
  }
  return descendants;
}

export default function App() {
  const [hierarchy, setHierarchy] = useState<HierarchyResponse | null>(null);
  const [selection, setSelection] = useState<ObjectRef | null>(null);
  const [document, setDocument] = useState<CadDocument | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const model = "gpt-5.6";
  const [view, setView] = useState<"library" | "editor" | "marketplace" | "community" | "scans">("library");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>(savedDisplayUnit);
  const [themePreference, setThemePreference] = useState<ThemePreference>(savedThemePreference);
  const [centerMode, setCenterMode] = useState<"3d" | "agent" | "split">("split");
  const [agentMaximized, setAgentMaximized] = useState(false);
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entityDialog, setEntityDialog] = useState<EntityDialogRequest | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [extensions, setExtensions] = useState<MarketplaceExtension[]>([]);
  const [communityListings, setCommunityListings] = useState<CommunityListing[]>([]);
  const [communityCategories, setCommunityCategories] = useState<CommunityCategory[]>([]);
  const [communityCommerceEnabled, setCommunityCommerceEnabled] = useState(false);
  const [scans, setScans] = useState<ScanAsset[]>([]);
  const [scanAccountMode, setScanAccountMode] = useState<"local" | "synced">("local");
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function start() {
      try {
        const [nextHierarchy, status, catalog, community, scanCatalog] = await Promise.all([
          api.hierarchy(),
          api.providerStatus(),
          api.extensions(),
          api.community(),
          api.scans(),
        ]);
        setHierarchy(nextHierarchy);
        setProviderConfigured(status.configured);
        setExtensions(catalog.extensions);
        setCommunityListings(community.listings);
        setCommunityCategories(community.categories);
        setCommunityCommerceEnabled(community.commerce_enabled);
        setScans(scanCatalog.scans);
        setScanAccountMode(scanCatalog.account_mode);
        const ref = selectedRef(nextHierarchy);
        setSelection(ref);
        if (ref) {
          const [build, agent] = await Promise.all([
            api.document(ref),
            api.agentConversation(ref),
          ]);
          applyBuild(build, ref);
          setConversation(agent);
        }
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setInitializing(false);
      }
    }
    void start();
  }, []);

  function applyBuild(build: BuildResponse, ref: ObjectRef) {
    setDocument(build.document);
    setPreviewRevision(build.preview_revision);
    setSelectedId((current) =>
      build.document.features.some((feature) => feature.id === current)
        ? current
        : build.document.features.at(-1)?.id ?? null,
    );
    setHierarchy((current) => {
      if (!current) return current;
      return {
        ...current,
        workspaces: current.workspaces.map((workspace) =>
          workspace.id !== ref.workspaceId
            ? workspace
            : {
                ...workspace,
                projects: workspace.projects.map((project) =>
                  project.id !== ref.projectId
                    ? project
                    : {
                        ...project,
                        objects: project.objects.map((cadObject) =>
                          cadObject.id !== ref.objectId
                            ? cadObject
                            : {
                                ...cadObject,
                                name: build.document.name,
                                revision: build.document.revision,
                              },
                        ),
                      },
                ),
              },
        ),
      };
    });
  }

  async function selectObject(ref: ObjectRef) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSelection(ref);
    try {
      const [build, agent] = await Promise.all([
        api.document(ref),
        api.agentConversation(ref),
      ]);
      applyBuild(build, ref);
      setConversation(agent);
      setView("editor");
    } catch (caught) {
      setDocument(null);
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function applyHierarchyMutation(mutation: Promise<HierarchyResponse>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextHierarchy = await mutation;
      setHierarchy(nextHierarchy);
      const ref = selectedRef(nextHierarchy);
      setSelection(ref);
      setDocument(null);
      setConversation(null);
      setSelectedId(null);
      if (ref) {
        const [build, agent] = await Promise.all([
          api.document(ref),
          api.agentConversation(ref),
        ]);
        applyBuild(build, ref);
        setConversation(agent);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const selectedWorkspace = useMemo(
    () => hierarchy?.workspaces.find((item) => item.id === selection?.workspaceId) ?? null,
    [hierarchy, selection],
  );
  const selectedProject = useMemo(
    () => selectedWorkspace?.projects.find((item) => item.id === selection?.projectId) ?? null,
    [selectedWorkspace, selection],
  );
  const selectedObject = useMemo(
    () => selectedProject?.objects.find((item) => item.id === selection?.objectId) ?? null,
    [selectedProject, selection],
  );
  const selectedFeature = useMemo(
    () => document?.features.find((feature) => feature.id === selectedId) ?? null,
    [document, selectedId],
  );
  const projectContext = useMemo(() => [
    selectedWorkspace?.name,
    selectedProject?.name,
    selectedObject?.name,
    document?.name,
    ...document?.features.map((feature) => `${feature.name} ${feature.type}`) ?? [],
  ].filter(Boolean).join(" · ") || "No CAD object selected", [selectedWorkspace, selectedProject, selectedObject, document]);
  const resolvedTheme = useMemo<ThemeId>(
    () => themePreference === "adaptive" ? adaptiveTheme(projectContext) : themePreference,
    [themePreference, projectContext],
  );

  useEffect(() => {
    window.document.documentElement.dataset.theme = resolvedTheme;
    window.document.documentElement.dataset.themePreference = themePreference;
  }, [resolvedTheme, themePreference]);

  async function sendAgentPrompt(nextPrompt: string) {
    if (!nextPrompt.trim() || busy || !selection || !document) return;
    if (!providerConfigured) {
      setSettingsOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    setStreamingText("");
    setCenterMode((current) => current === "3d" ? "split" : current);
    try {
      await api.streamAgentMessage(selection, nextPrompt, model, (event) => {
        if (event.event === "conversation") {
          setConversation(event.data);
          setStreamingText("");
        } else if (event.event === "tool") {
          setConversation((current) => current ? {
            ...current,
            tool_events: [
              ...current.tool_events.filter((item) => item.id !== event.data.id),
              event.data,
            ],
          } : current);
        } else if (event.event === "proposal") {
          setConversation((current) => current ? { ...current, proposal: event.data } : current);
        } else if (event.event === "delta") {
          setStreamingText((current) => current + event.data.text);
        } else if (event.event === "error") {
          setError(event.data.detail);
        }
      });
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
    } finally {
      setBusy(false);
      setStreamingText("");
    }
  }

  async function applyAgentProposal() {
    if (!selection || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.applyAgentProposal(selection);
      applyBuild(result.build, selection);
      setConversation(result.conversation);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function discardAgentProposal() {
    if (!selection || busy) return;
    setBusy(true);
    try {
      setConversation(await api.discardAgentProposal(selection));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function updateFeatureNumber(key: string, value: number) {
    if (
      !document ||
      !selection ||
      !selectedFeature ||
      !Number.isFinite(value) ||
      busy
    ) {
      return;
    }
    const candidate = structuredClone(document);
    const feature = candidate.features.find((item) => item.id === selectedFeature.id);
    if (!feature) return;
    const positiveKeys = new Set(["width", "depth", "height", "radius", "diameter", "distance"]);
    if (positiveKeys.has(key) && value <= 0) return;
    if (key.startsWith("parameters.") && feature.type === "custom_cadquery") {
      const index = Number(key.split(".")[1]);
      feature.parameters[index].value = value;
    } else if (key.startsWith("points.") && feature.type === "hole_pattern") {
      const [, index, axis] = key.split(".");
      feature.points[Number(index)][axis as "x" | "y"] = value;
    } else {
      (feature as unknown as Record<string, unknown>)[key] = value;
    }
    setBusy(true);
    setError(null);
    try {
      applyBuild(await api.updateDocument(selection, candidate), selection);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function commitFeatureDocument(candidate: CadDocument, selectAfter?: string) {
    if (!selection || busy) return;
    setBusy(true);
    setError(null);
    try {
      applyBuild(await api.updateDocument(selection, candidate), selection);
      if (selectAfter) setSelectedId(selectAfter);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function addFeature(feature: Feature) {
    if (!document) return;
    const candidate = structuredClone(document);
    candidate.features.push(feature);
    void commitFeatureDocument(candidate, feature.id);
  }

  function deleteFeature(feature: Feature) {
    if (!document) return;
    const removed = descendantIds(document.features, feature.id);
    const childCount = removed.size - 1;
    setEntityDialog({
      kind: "delete",
      entity: "feature",
      title: `Delete “${feature.name}”?`,
      description: childCount
        ? `This also deletes ${childCount} dependent ${childCount === 1 ? "feature" : "features"}. The entire operation can be restored with Undo.`
        : "This feature will be removed from the model. You can restore it with Undo.",
      submitLabel: childCount ? `Delete ${removed.size} features` : "Delete feature",
      onSubmit: () => {
        const candidate = structuredClone(document);
        candidate.features = candidate.features.filter((item) => !removed.has(item.id));
        void commitFeatureDocument(candidate);
      },
    });
  }

  function toggleFeatureSuppressed(feature: Feature) {
    if (!document) return;
    const candidate = structuredClone(document);
    const affected = feature.enabled
      ? descendantIds(candidate.features, feature.id)
      : new Set([feature.id]);
    candidate.features.forEach((item) => {
      if (affected.has(item.id)) item.enabled = !feature.enabled;
    });
    void commitFeatureDocument(candidate, feature.id);
  }

  function reorderFeature(sourceId: string, targetId: string) {
    if (!document) return;
    const candidate = structuredClone(document);
    const sourceIndex = candidate.features.findIndex((feature) => feature.id === sourceId);
    if (sourceIndex < 0) return;
    const [moved] = candidate.features.splice(sourceIndex, 1);
    const targetIndex = candidate.features.findIndex((feature) => feature.id === targetId);
    if (targetIndex < 0) return;
    candidate.features.splice(targetIndex, 0, moved);
    void commitFeatureDocument(candidate, sourceId);
  }

  async function importModel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selection) return;
    setBusy(true);
    setError(null);
    try {
      const build = await api.importModel(selection, file);
      applyBuild(build, selection);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function historyAction(action: "undo" | "redo") {
    if (!selection) return;
    setBusy(true);
    setError(null);
    try {
      applyBuild(await api[action](selection), selection);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveApiKey(apiKey: string) {
    const status = await api.saveApiKey(apiKey);
    setProviderConfigured(status.configured);
  }

  async function extensionMutation(mutation: Promise<{ extensions: MarketplaceExtension[] }>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setExtensions((await mutation).extensions);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function connectTrellis(endpoint: string, token: string) {
    setBusy(true);
    setError(null);
    try {
      setExtensions((await api.connectTrellis(endpoint, token)).extensions);
    } catch (caught) {
      setError(errorMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  async function createCommunityDraft(draft: CommunityListingDraft) {
    if (!selection || busy) return;
    setBusy(true);
    setError(null);
    try {
      const catalog = await api.createCommunityDraft(selection, draft);
      setCommunityListings(catalog.listings);
      setCommunityCategories(catalog.categories);
      setCommunityCommerceEnabled(catalog.commerce_enabled);
    } catch (caught) {
      setError(errorMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  async function deleteCommunityDraft(listingId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const catalog = await api.deleteCommunityDraft(listingId);
      setCommunityListings(catalog.listings);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function copyScanToProject(scanId: string, workspaceId: string, projectId: string, name: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.copyScan(scanId, workspaceId, projectId, name);
      setHierarchy(result.hierarchy);
      const ref = selectedRef(result.hierarchy);
      if (!ref) throw new Error("The copied scan object could not be selected");
      setSelection(ref);
      const [build, agent] = await Promise.all([api.document(ref), api.agentConversation(ref)]);
      applyBuild(build, ref);
      setConversation(agent);
      setView("editor");
    } catch (caught) {
      setError(errorMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  if (initializing || !hierarchy) {
    return (
      <main className="loading-screen">
        <div className="brand-mark brand-logo loading-logo"><img src="/marul3d-logo.png" alt="" /></div>
        <LoaderCircle className="spin" size={22} />
        <span>Loading local workspaces…</span>
        {error && <strong>{error}</strong>}
      </main>
    );
  }

  const exportStep = selection ? api.exportUrl(selection, "step") : undefined;
  const exportStl = selection ? api.exportUrl(selection, "stl") : undefined;
  const projectCount = hierarchy.workspaces.reduce(
    (count, workspace) => count + workspace.projects.length,
    0,
  );
  const objectCount = hierarchy.workspaces.reduce(
    (count, workspace) =>
      count + workspace.projects.reduce((total, project) => total + project.objects.length, 0),
    0,
  );

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="wordmark">
          <span className="brand-mark brand-logo"><img src="/marul3d-logo.png" alt="" /></span>
          <strong>marul<span>3D</span></strong>
        </div>
        <div className="document-title">
          {view === "library" ? (
            <><LayoutGrid size={14} /><strong>CAD Library</strong></>
          ) : view === "marketplace" ? (
            <><Blocks size={14} /><strong>Extension Marketplace</strong></>
          ) : view === "community" ? (
            <><Store size={14} /><strong>Community CAD Market</strong></>
          ) : view === "scans" ? (
            <><ScanLine size={14} /><strong>Scans</strong></>
          ) : (
            <>
              <Box size={14} />
              <span>{selectedWorkspace?.name ?? "No workspace"}</span>
              {selectedProject && <><i>/</i><span>{selectedProject.name}</span></>}
              {selectedObject && <><i>/</i><strong>{selectedObject.name}</strong></>}
              {document && <small>r{document.revision}</small>}
            </>
          )}
        </div>
        <nav className="title-actions">
          {view === "editor" && (
            <>
              <button type="button" className="toolbar-button" disabled={busy || !document} onClick={() => importInput.current?.click()}><FileUp size={15} /> Import</button>
              <div className="export-menu">
                <a className={`toolbar-button ${!exportStep ? "disabled" : ""}`} href={exportStep}><Download size={15} /> STEP</a>
                <a className={`toolbar-button ${!exportStl ? "disabled" : ""}`} href={exportStl}>STL</a>
              </div>
            </>
          )}
          <button type="button" className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={17} /></button>
        </nav>
        <input ref={importInput} hidden type="file" accept=".step,.stp,.stl" onChange={importModel} />
      </header>

      <div className={`workspace ${view === "editor" && !sidebarOpen ? "sidebar-collapsed" : ""} ${view === "editor" && !inspectorOpen ? "inspector-collapsed" : ""} ${view === "editor" && agentMaximized ? "agent-maximized" : ""}`}>
        <nav className="activity-bar" aria-label="Workspace sections">
          <button className={`activity ${view === "library" ? "active" : ""}`} type="button" aria-label="CAD library" onClick={() => setView("library")}><LayoutGrid size={21} /></button>
          <button
            className={`activity ${view === "editor" ? "active" : ""}`}
            type="button"
            aria-label="3D editor"
            title="3D editor"
            disabled={!document || !selection}
            onClick={() => setView("editor")}
          >
            <Layers3 size={21} />
          </button>
          <button className={`activity ${view === "marketplace" ? "active" : ""}`} type="button" aria-label="Extension Marketplace" title="Extension Marketplace" onClick={() => setView("marketplace")}><Blocks size={21} /></button>
          <button className={`activity ${view === "community" ? "active" : ""}`} type="button" aria-label="Community CAD Market" title="Community CAD Market" onClick={() => setView("community")}><Store size={21} /></button>
          <button className={`activity ${view === "scans" ? "active" : ""}`} type="button" aria-label="Scans" title="Scans" onClick={() => setView("scans")}><ScanLine size={21} /></button>
          <span className="activity-spacer" />
          <span className={`provider-dot ${providerConfigured ? "connected" : ""}`} title="OpenAI connection" />
        </nav>

        {view === "library" ? (
          <LibraryBrowser
            hierarchy={hierarchy}
            disabled={busy}
            previewUrl={api.previewUrl}
            onSelectObject={(ref) => void selectObject(ref)}
            onCreateWorkspace={() => {
              setEntityDialog({ kind: "name", entity: "workspace", title: "Create a new workspace", label: "Workspace name", initialValue: "New Workspace", submitLabel: "Create workspace", onSubmit: (name) => void applyHierarchyMutation(api.createWorkspace(name)) });
            }}
            onRenameWorkspace={(id, currentName) => {
              setEntityDialog({ kind: "name", entity: "workspace", title: "Rename workspace", label: "Workspace name", initialValue: currentName, submitLabel: "Save name", onSubmit: (name) => void applyHierarchyMutation(api.renameWorkspace(id, name)) });
            }}
            onDeleteWorkspace={(id, name) => {
              setEntityDialog({ kind: "delete", entity: "workspace", title: `Delete “${name}”?`, description: "This workspace and everything inside it will be moved to marul3D’s local trash for manual recovery.", submitLabel: "Delete workspace", onSubmit: () => void applyHierarchyMutation(api.deleteWorkspace(id)) });
            }}
            onCreateProject={(workspaceId) => {
              setEntityDialog({ kind: "name", entity: "project", title: "Create a new project", label: "Project name", initialValue: "New Project", submitLabel: "Create project", onSubmit: (name) => void applyHierarchyMutation(api.createProject(workspaceId, name)) });
            }}
            onRenameProject={(workspaceId, projectId, currentName) => {
              setEntityDialog({ kind: "name", entity: "project", title: "Rename project", label: "Project name", initialValue: currentName, submitLabel: "Save name", onSubmit: (name) => void applyHierarchyMutation(api.renameProject(workspaceId, projectId, name)) });
            }}
            onDeleteProject={(workspaceId, projectId, name) => {
              setEntityDialog({ kind: "delete", entity: "project", title: `Delete “${name}”?`, description: "This project and every CAD object inside it will be moved to marul3D’s local trash.", submitLabel: "Delete project", onSubmit: () => void applyHierarchyMutation(api.deleteProject(workspaceId, projectId)) });
            }}
            onCreateObject={(workspaceId, projectId) => {
              setEntityDialog({ kind: "name", entity: "object", title: "Create a new CAD object", label: "Object name", initialValue: "New Part", submitLabel: "Create object", onSubmit: (name) => void applyHierarchyMutation(api.createObject(workspaceId, projectId, name)) });
            }}
            onRenameObject={(ref, currentName) => {
              setEntityDialog({ kind: "name", entity: "object", title: "Rename CAD object", label: "Object name", initialValue: currentName, submitLabel: "Save name", onSubmit: (name) => void applyHierarchyMutation(api.renameObject(ref, name)) });
            }}
            onDeleteObject={(ref, name) => {
              setEntityDialog({ kind: "delete", entity: "object", title: `Delete “${name}”?`, description: "This CAD object and its checkpoint history will be moved to marul3D’s local trash.", submitLabel: "Delete object", onSubmit: () => void applyHierarchyMutation(api.deleteObject(ref)) });
            }}
          />
        ) : view === "marketplace" ? (
          <MarketplaceBrowser
            extensions={extensions}
            busy={busy}
            onInstall={(id) => void extensionMutation(api.installExtension(id))}
            onUninstall={(id) => void extensionMutation(api.uninstallExtension(id))}
            onEnable={(id, enabled) => void extensionMutation(api.enableExtension(id, enabled))}
            onConnectTrellis={connectTrellis}
            onDisconnectTrellis={() => void extensionMutation(api.disconnectTrellis())}
          />
        ) : view === "community" ? (
          <CommunityBrowser
            listings={communityListings}
            categories={communityCategories}
            commerceEnabled={communityCommerceEnabled}
            selectedObjectName={selectedObject?.name ?? null}
            canCreateDraft={Boolean(selection && selectedObject)}
            busy={busy}
            onCreateDraft={createCommunityDraft}
            onDeleteDraft={(listingId) => void deleteCommunityDraft(listingId)}
          />
        ) : view === "scans" ? (
          <ScansBrowser
            scans={scans}
            hierarchy={hierarchy}
            accountMode={scanAccountMode}
            busy={busy}
            onCopy={copyScanToProject}
          />
        ) : document && selection ? (
          <>
            {sidebarOpen && (
              <EditorSidebar
                hierarchy={hierarchy}
                selection={selection}
                features={document.features}
                selectedId={selectedId}
                disabled={busy}
                onSelectObject={(ref) => void selectObject(ref)}
                onSelectFeature={setSelectedId}
                onToggle={() => setSidebarOpen(false)}
                onUndo={() => void historyAction("undo")}
                onRedo={() => void historyAction("redo")}
                onAdd={() => setFeatureDialogOpen(true)}
                onDelete={deleteFeature}
                onToggleSuppressed={toggleFeatureSuppressed}
                onReorder={reorderFeature}
              />
            )}
            <main className={`center-workspace mode-${centerMode}`}>
              <div className="center-tabbar">
                {!sidebarOpen && !agentMaximized && (
                  <button className="viewport-sidebar-toggle" type="button" aria-label="Open CAD explorer" title="Open CAD explorer" onClick={() => setSidebarOpen(true)}>
                    <PanelLeftOpen size={15} />
                  </button>
                )}
                <button className={`center-tab ${centerMode === "3d" ? "active" : ""}`} type="button" onClick={() => { setCenterMode("3d"); setAgentMaximized(false); }}><Box size={14} /> 3D View</button>
                <button className={`center-tab ${centerMode === "agent" ? "active" : ""}`} type="button" onClick={() => setCenterMode("agent")}><MessageSquare size={14} /> Agent</button>
                <button className={`center-tab split-tab ${centerMode === "split" ? "active" : ""}`} type="button" aria-label="Split 3D and Agent view" onClick={() => { setCenterMode("split"); setAgentMaximized(false); }}><Columns2 size={14} /> Split</button>
                <div className="viewport-status">
                  {busy ? <><LoaderCircle className="spin" size={13} /> Agent working</> : <>B-rep valid</>}
                </div>
                {!inspectorOpen && !agentMaximized && (
                  <button className="viewport-inspector-toggle" type="button" aria-label="Open Properties" title="Open Properties" onClick={() => setInspectorOpen(true)}>
                    <PanelRightOpen size={15} />
                  </button>
                )}
                {centerMode !== "3d" && (
                  <button className="center-maximize" type="button" aria-label={agentMaximized ? "Exit full screen Agent" : "Full screen Agent"} onClick={() => { setAgentMaximized((value) => !value); setCenterMode("agent"); }}>
                    {agentMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                )}
              </div>
              {centerMode !== "agent" && (
                <section className="viewport-panel">
                  <CadViewport key={`${selection.objectId}-${previewRevision}`} previewUrl={api.previewUrl(selection, previewRevision)} />
                </section>
              )}
              {centerMode !== "3d" && (
                <AgentPanel
                  conversation={conversation}
                  proposal={conversation?.proposal ?? null}
                  streamingText={streamingText}
                  busy={busy}
                  objectName={document.name}
                  selectedFeatureName={selectedFeature?.name}
                  onSend={(value) => void sendAgentPrompt(value)}
                  onApply={() => void applyAgentProposal()}
                  onDiscard={() => void discardAgentProposal()}
                />
              )}
              {error && <div className="error-banner" role="alert">{error}</div>}
            </main>
            {inspectorOpen && (
              <Inspector
                feature={selectedFeature}
                displayUnit={displayUnit}
                disabled={busy}
                onToggle={() => setInspectorOpen(false)}
                onDisplayUnitChange={(unit) => {
                  setDisplayUnit(unit);
                  try {
                    window.localStorage?.setItem("marul3d.displayUnit", unit);
                  } catch {
                    // Storage can be unavailable in privacy-restricted browser contexts.
                  }
                }}
                onNumericChange={updateFeatureNumber}
              />
            )}
          </>
        ) : null}
      </div>

      {error && view !== "editor" && <div className="global-error-banner" role="alert">{error}</div>}

      <footer className="statusbar">
        <span><span className="status-dot" /> Local engine</span>
        <span>Parametric B-rep engine</span>
        <span className="status-spacer" />
        <span>{hierarchy.workspaces.length} workspaces</span>
        <span>{projectCount} projects</span>
        <span>{objectCount} objects</span>
        <span>{extensions.filter((extension) => extension.installed).length} extensions</span>
        <span>macOS</span>
      </footer>

      {settingsOpen && (
        <SettingsDialog
          configured={providerConfigured}
          theme={themePreference}
          resolvedTheme={resolvedTheme}
          projectContext={projectContext}
          agentRequestCount={conversation?.messages.filter((message) => message.role === "user").length ?? 0}
          onThemeChange={(theme) => {
            setThemePreference(theme);
            try {
              window.localStorage?.setItem("marul3d.theme", theme);
            } catch {
              // Storage can be unavailable in privacy-restricted browser contexts.
            }
          }}
          onClose={() => setSettingsOpen(false)}
          onSave={saveApiKey}
        />
      )}
      {entityDialog && (
        <EntityDialog request={entityDialog} onClose={() => setEntityDialog(null)} />
      )}
      {featureDialogOpen && document && (
        <FeatureDialog
          features={document.features}
          onClose={() => setFeatureDialogOpen(false)}
          onCreate={addFeature}
        />
      )}
    </div>
  );
}

import {
  Box,
  ChevronDown,
  Download,
  FileUp,
  History,
  Layers3,
  LoaderCircle,
  Play,
  Redo2,
  Settings,
  Sparkles,
  Undo2,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { CadViewport } from "./components/CadViewport";
import { Inspector } from "./components/Inspector";
import { SettingsDialog } from "./components/SettingsDialog";
import { WorkspaceExplorer } from "./components/WorkspaceExplorer";
import type {
  BuildResponse,
  CadDocument,
  HierarchyResponse,
  ObjectRef,
} from "./types";

type ChatMessage = { role: "user" | "assistant"; text: string };

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

function askName(label: string, currentName = ""): string | null {
  const value = window.prompt(label, currentName)?.trim();
  return value ? value : null;
}

export default function App() {
  const [hierarchy, setHierarchy] = useState<HierarchyResponse | null>(null);
  const [selection, setSelection] = useState<ObjectRef | null>(null);
  const [document, setDocument] = useState<CadDocument | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const model = "gpt-5.6";
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Select a CAD object, then ask me to create or edit its features.",
    },
  ]);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function start() {
      try {
        const [nextHierarchy, status] = await Promise.all([
          api.hierarchy(),
          api.providerStatus(),
        ]);
        setHierarchy(nextHierarchy);
        setProviderConfigured(status.configured);
        const ref = selectedRef(nextHierarchy);
        setSelection(ref);
        if (ref) applyBuild(await api.document(ref), ref);
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
      const build = await api.document(ref);
      applyBuild(build, ref);
      setMessages([
        { role: "assistant", text: `Editing ${build.document.name}. What should we change?` },
      ]);
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
      setSelectedId(null);
      if (ref) {
        const build = await api.document(ref);
        applyBuild(build, ref);
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

  async function submitPrompt(event: FormEvent) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || busy || !selection || !document) return;
    if (!providerConfigured) {
      setSettingsOpen(true);
      return;
    }
    setPrompt("");
    setMessages((current) => [...current, { role: "user", text: nextPrompt }]);
    setBusy(true);
    setError(null);
    try {
      const build = await api.generate(selection, nextPrompt, model);
      applyBuild(build, selection);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: build.summary ?? "Object rebuilt successfully." },
      ]);
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: `Build stopped: ${message}` },
      ]);
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
      value <= 0 ||
      busy
    ) {
      return;
    }
    const candidate = structuredClone(document);
    const feature = candidate.features.find((item) => item.id === selectedFeature.id);
    if (!feature) return;
    if (key.startsWith("parameters.") && feature.type === "custom_cadquery") {
      const index = Number(key.split(".")[1]);
      feature.parameters[index].value = value;
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

  async function importModel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selection) return;
    setBusy(true);
    setError(null);
    try {
      const build = await api.importModel(selection, file);
      applyBuild(build, selection);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: build.summary ?? "Import complete." },
      ]);
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

  if (initializing || !hierarchy) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><Layers3 size={26} /></div>
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
          <span className="brand-mark"><Layers3 size={17} /></span>
          <strong>marul<span>3D</span></strong>
        </div>
        <div className="document-title">
          <Box size={14} />
          <span>{selectedWorkspace?.name ?? "No workspace"}</span>
          {selectedProject && <><i>/</i><span>{selectedProject.name}</span></>}
          {selectedObject && <><i>/</i><strong>{selectedObject.name}</strong></>}
          {document && <small>r{document.revision}</small>}
        </div>
        <nav className="title-actions">
          <button type="button" className="icon-button" aria-label="Undo" disabled={busy || !document} onClick={() => historyAction("undo")}><Undo2 size={16} /></button>
          <button type="button" className="icon-button" aria-label="Redo" disabled={busy || !document} onClick={() => historyAction("redo")}><Redo2 size={16} /></button>
          <span className="title-divider" />
          <button type="button" className="toolbar-button" disabled={busy || !document} onClick={() => importInput.current?.click()}><FileUp size={15} /> Import</button>
          <div className="export-menu">
            <a className={`toolbar-button ${!exportStep ? "disabled" : ""}`} href={exportStep}><Download size={15} /> STEP</a>
            <a className={`toolbar-button ${!exportStl ? "disabled" : ""}`} href={exportStl}>STL</a>
          </div>
          <button type="button" className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={17} /></button>
        </nav>
        <input ref={importInput} hidden type="file" accept=".step,.stp,.stl" onChange={importModel} />
      </header>

      <div className="workspace">
        <nav className="activity-bar" aria-label="Workspace sections">
          <button className="activity active" type="button" aria-label="Model"><Layers3 size={21} /></button>
          <button className="activity" type="button" aria-label="History"><History size={21} /></button>
          <span className="activity-spacer" />
          <span className={`provider-dot ${providerConfigured ? "connected" : ""}`} title="OpenAI connection" />
        </nav>

        <WorkspaceExplorer
          hierarchy={hierarchy}
          selection={selection}
          features={document?.features ?? []}
          selectedFeatureId={selectedId}
          disabled={busy}
          onSelectObject={(ref) => void selectObject(ref)}
          onSelectFeature={setSelectedId}
          onCreateWorkspace={() => {
            const name = askName("Workspace name", "New Workspace");
            if (name) void applyHierarchyMutation(api.createWorkspace(name));
          }}
          onRenameWorkspace={(id, currentName) => {
            const name = askName("Rename workspace", currentName);
            if (name) void applyHierarchyMutation(api.renameWorkspace(id, name));
          }}
          onDeleteWorkspace={(id, name) => {
            if (window.confirm(`Delete workspace “${name}” and all of its projects and objects?`)) {
              void applyHierarchyMutation(api.deleteWorkspace(id));
            }
          }}
          onCreateProject={(workspaceId) => {
            const name = askName("Project name", "New Project");
            if (name) void applyHierarchyMutation(api.createProject(workspaceId, name));
          }}
          onRenameProject={(workspaceId, projectId, currentName) => {
            const name = askName("Rename project", currentName);
            if (name) void applyHierarchyMutation(api.renameProject(workspaceId, projectId, name));
          }}
          onDeleteProject={(workspaceId, projectId, name) => {
            if (window.confirm(`Delete project “${name}” and all of its objects?`)) {
              void applyHierarchyMutation(api.deleteProject(workspaceId, projectId));
            }
          }}
          onCreateObject={(workspaceId, projectId) => {
            const name = askName("CAD object name", "New Part");
            if (name) void applyHierarchyMutation(api.createObject(workspaceId, projectId, name));
          }}
          onRenameObject={(ref, currentName) => {
            const name = askName("Rename CAD object", currentName);
            if (name) void applyHierarchyMutation(api.renameObject(ref, name));
          }}
          onDeleteObject={(ref, name) => {
            if (window.confirm(`Delete CAD object “${name}”?`)) {
              void applyHierarchyMutation(api.deleteObject(ref));
            }
          }}
        />

        <main className="center-workspace">
          <section className="viewport-panel">
            <div className="viewport-tabbar">
              <div className="viewport-tab active"><Box size={14} /> 3D View</div>
              <div className="viewport-status">
                {busy ? <><LoaderCircle className="spin" size={13} /> Rebuilding</> : document ? <>B-rep valid</> : <>No object selected</>}
              </div>
            </div>
            {document && selection ? (
              <CadViewport
                key={`${selection.objectId}-${previewRevision}`}
                previewUrl={api.previewUrl(selection, previewRevision)}
              />
            ) : (
              <div className="empty-viewport">
                <Layers3 size={38} />
                <h2>Select a CAD object</h2>
                <p>Create a workspace, add a project, then create or select an object.</p>
              </div>
            )}
          </section>

          <section className="prompt-panel">
            <div className="prompt-header">
              <div><Sparkles size={14} /> MARUL ASSIST</div>
              <button className="model-picker" type="button">OpenAI · {model} <ChevronDown size={13} /></button>
            </div>
            <div className="message-strip">
              {messages.slice(-2).map((message, index) => (
                <div className={`message ${message.role}`} key={`${message.role}-${index}-${message.text}`}>
                  <span>{message.role === "assistant" ? "M" : "You"}</span>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
            <form className="prompt-composer" onSubmit={submitPrompt}>
              <textarea
                aria-label="CAD prompt"
                placeholder={document ? "Describe a new part or edit this CAD object…" : "Select a CAD object to start editing…"}
                value={prompt}
                disabled={!document}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="composer-footer">
                <span>{selectedFeature ? `Context: ${selectedFeature.name}` : document ? `Context: ${document.name}` : "No CAD object selected"}</span>
                <button className="run-button" type="submit" disabled={!prompt.trim() || busy || !document}>
                  {busy ? <LoaderCircle className="spin" size={16} /> : <Play size={15} fill="currentColor" />}
                  Build
                </button>
              </div>
            </form>
            {error && <div className="error-banner" role="alert">{error}</div>}
          </section>
        </main>

        <Inspector feature={selectedFeature} disabled={busy} onNumericChange={updateFeatureNumber} />
      </div>

      <footer className="statusbar">
        <span><span className="status-dot" /> Local engine</span>
        <span>CadQuery · OpenCascade</span>
        <span className="status-spacer" />
        <span>{hierarchy.workspaces.length} workspaces</span>
        <span>{projectCount} projects</span>
        <span>{objectCount} objects</span>
        <span>macOS</span>
      </footer>

      {settingsOpen && (
        <SettingsDialog configured={providerConfigured} onClose={() => setSettingsOpen(false)} onSave={saveApiKey} />
      )}
    </div>
  );
}

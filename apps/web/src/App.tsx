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
import { FeatureTree } from "./components/FeatureTree";
import { Inspector } from "./components/Inspector";
import { SettingsDialog } from "./components/SettingsDialog";
import type { BuildResponse, CadDocument } from "./types";

type ChatMessage = { role: "user" | "assistant"; text: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function App() {
  const [document, setDocument] = useState<CadDocument | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const model = "gpt-5.6";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Starter part rebuilt locally. Ask me to create a new part or change any feature.",
    },
  ]);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.document(), api.providerStatus()])
      .then(([build, status]) => {
        applyBuild(build);
        setProviderConfigured(status.configured);
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, []);

  function applyBuild(build: BuildResponse) {
    setDocument(build.document);
    setPreviewRevision(build.preview_revision);
    setSelectedId((current) =>
      build.document.features.some((feature) => feature.id === current)
        ? current
        : build.document.features.at(-1)?.id ?? null,
    );
  }

  const selectedFeature = useMemo(
    () => document?.features.find((feature) => feature.id === selectedId) ?? null,
    [document, selectedId],
  );

  async function submitPrompt(event: FormEvent) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || busy) return;
    if (!providerConfigured) {
      setSettingsOpen(true);
      return;
    }
    setPrompt("");
    setMessages((current) => [...current, { role: "user", text: nextPrompt }]);
    setBusy(true);
    setError(null);
    try {
      const build = await api.generate(nextPrompt, model);
      applyBuild(build);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: build.summary ?? "Model rebuilt successfully." },
      ]);
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      setMessages((current) => [...current, { role: "assistant", text: `Build stopped: ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function updateFeatureNumber(key: string, value: number) {
    if (!document || !selectedFeature || !Number.isFinite(value) || value <= 0 || busy) return;
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
      applyBuild(await api.updateDocument(candidate));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function importModel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const build = await api.importModel(file);
      applyBuild(build);
      setMessages((current) => [...current, { role: "assistant", text: build.summary ?? "Import complete." }]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function historyAction(action: "undo" | "redo") {
    setBusy(true);
    setError(null);
    try {
      applyBuild(await api[action]());
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

  if (!document) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><Layers3 size={26} /></div>
        <LoaderCircle className="spin" size={22} />
        <span>Starting local CAD engine…</span>
        {error && <strong>{error}</strong>}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="wordmark">
          <span className="brand-mark"><Layers3 size={17} /></span>
          <strong>marul<span>3D</span></strong>
        </div>
        <div className="document-title">
          <Box size={14} />
          <span>{document.name}</span>
          <small>r{document.revision}</small>
        </div>
        <nav className="title-actions">
          <button type="button" className="icon-button" aria-label="Undo" disabled={busy} onClick={() => historyAction("undo")}>
            <Undo2 size={16} />
          </button>
          <button type="button" className="icon-button" aria-label="Redo" disabled={busy} onClick={() => historyAction("redo")}>
            <Redo2 size={16} />
          </button>
          <span className="title-divider" />
          <button type="button" className="toolbar-button" disabled={busy} onClick={() => importInput.current?.click()}>
            <FileUp size={15} /> Import
          </button>
          <div className="export-menu">
            <a className="toolbar-button" href="/api/export/step">
              <Download size={15} /> STEP
            </a>
            <a className="toolbar-button" href="/api/export/stl">
              STL
            </a>
          </div>
          <button type="button" className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings size={17} />
          </button>
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

        <FeatureTree
          name={document.name}
          features={document.features}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <main className="center-workspace">
          <section className="viewport-panel">
            <div className="viewport-tabbar">
              <div className="viewport-tab active"><Box size={14} /> 3D View</div>
              <div className="viewport-status">
                {busy ? <><LoaderCircle className="spin" size={13} /> Rebuilding</> : <>B-rep valid</>}
              </div>
            </div>
            <CadViewport revision={previewRevision} />
          </section>

          <section className="prompt-panel">
            <div className="prompt-header">
              <div><Sparkles size={14} /> MARUL ASSIST</div>
              <button className="model-picker" type="button">
                OpenAI · {model} <ChevronDown size={13} />
              </button>
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
                placeholder="Describe a new part or ask marul3D to edit the selected feature…"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="composer-footer">
                <span>{selectedFeature ? `Context: ${selectedFeature.name}` : "Context: full model"}</span>
                <button className="run-button" type="submit" disabled={!prompt.trim() || busy}>
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
        <span>{document.units}</span>
        <span>{document.features.length} features</span>
        <span>macOS</span>
      </footer>

      {settingsOpen && (
        <SettingsDialog configured={providerConfigured} onClose={() => setSettingsOpen(false)} onSave={saveApiKey} />
      )}
    </div>
  );
}

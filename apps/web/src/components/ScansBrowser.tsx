import {
  Camera,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Cpu,
  Database,
  FolderKanban,
  Image,
  Info,
  LoaderCircle,
  Maximize2,
  ScanLine,
  Smartphone,
  Triangle,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { HierarchyResponse, ScanAsset } from "../types";

type ScansBrowserProps = {
  scans: ScanAsset[];
  hierarchy: HierarchyResponse;
  accountMode: "local" | "synced";
  busy: boolean;
  onCopy: (scanId: string, workspaceId: string, projectId: string, name: string) => Promise<void>;
};

function capturedDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function ScansBrowser({ scans, hierarchy, accountMode, busy, onCopy }: ScansBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyScan, setCopyScan] = useState<ScanAsset | null>(null);
  const selected = scans.find((scan) => scan.id === selectedId) ?? null;
  const readyCount = scans.filter((scan) => scan.status === "ready").length;

  return (
    <main className={`scans-browser ${selected ? "details-open" : ""}`}>
      <section className="scans-content">
        <header className="scans-hero">
          <div>
            <span className="scans-eyebrow"><ScanLine size={12} /> CAPTURE LIBRARY</span>
            <h1>Scans</h1>
            <p>Turn real objects into editable digital references and move them into any CAD project.</p>
          </div>
          <div className="scan-account-state"><span><Cloud size={14} /></span><div><strong>{accountMode === "synced" ? "Account synced" : "Local device library"}</strong><small>{accountMode === "synced" ? "Mobile and desktop" : "Sign-in sync comes with the mobile app"}</small></div></div>
        </header>

        <section className="scan-mobile-banner">
          <div className="phone-capture-visual"><Smartphone size={34} /><i /><i /><i /></div>
          <div><span>MOBILE CAPTURE — PLANNED</span><h2>Walk around it. Capture it. Make it useful.</h2><p>The future marul3D mobile app will guide a live camera capture, reconstruct the object in the cloud, then sync the result here under the same account.</p></div>
          <button type="button" disabled><Camera size={14} /> Start capture</button>
        </section>

        <div className="scans-section-heading"><div><strong>Your scan library</strong><span>{readyCount} ready · {scans.length - readyCount} processing</span></div><div><button className="selected" type="button">All scans</button><button type="button">Ready</button></div></div>
        <section className="scan-grid" aria-label="Scanned models">
          {scans.map((scan, index) => (
            <article className={`scan-card ${scan.status}`} key={scan.id} onClick={() => setSelectedId(scan.id)}>
              <div className={`scan-preview scan-variant-${index}`}>
                <div className="scan-point-cloud">{Array.from({ length: 24 }, (_, point) => <i key={point} />)}</div>
                <div className="scan-object-shape" />
                <span className={`scan-status ${scan.status}`}>{scan.status === "ready" ? <Check size={9} /> : scan.status === "processing" ? <LoaderCircle className="spin" size={9} /> : <Info size={9} />}{scan.status}</span>
                <span className="scan-view-icon"><Maximize2 size={12} /></span>
                {scan.status === "processing" && <div className="scan-progress"><span style={{ width: `${scan.progress}%` }} /><small>{scan.progress}% reconstructing</small></div>}
              </div>
              <div className="scan-card-copy">
                <div><span>{scan.quality} quality</span><small>{capturedDate(scan.captured_at)}</small></div>
                <h2>{scan.name}</h2>
                <p><Smartphone size={10} /> {scan.source_device}</p>
                <footer><span><Image size={10} /> {scan.image_count} frames</span>{scan.status === "ready" && <span><Triangle size={10} /> {Math.round(scan.triangle_count / 1000)}k tris</span>}<ChevronRight size={13} /></footer>
              </div>
            </article>
          ))}
        </section>
      </section>

      {selected && (
        <aside className="scan-details">
          <header><span>SCAN DETAILS</span><button className="icon-button" type="button" aria-label="Close scan details" onClick={() => setSelectedId(null)}><X size={15} /></button></header>
          <div className="scan-detail-preview"><div className="scan-point-cloud">{Array.from({ length: 30 }, (_, point) => <i key={point} />)}</div><div className="scan-object-shape" /><span>ORBIT PREVIEW</span></div>
          <div className="scan-detail-copy">
            <span className={`scan-status ${selected.status}`}>{selected.status === "ready" ? <Check size={9} /> : <LoaderCircle className={selected.status === "processing" ? "spin" : ""} size={9} />}{selected.status}</span>
            <h2>{selected.name}</h2>
            <p className="scan-captured"><Smartphone size={11} /> {selected.source_device}<span>·</span>{capturedDate(selected.captured_at)}</p>
            {selected.status === "ready" ? (
              <button className="primary-button copy-scan-button" type="button" disabled={busy} onClick={() => setCopyScan(selected)}><Copy size={14} /> Copy to project</button>
            ) : (
              <div className="detail-processing"><div><span style={{ width: `${selected.progress}%` }} /></div><strong>{selected.progress}% reconstructed</strong><small>You can close marul3D while cloud processing continues.</small></div>
            )}
            <section className="scan-spec-grid">
              <div><Image size={13} /><span>Capture frames</span><strong>{selected.image_count}</strong></div>
              <div><Triangle size={13} /><span>Triangles</span><strong>{selected.triangle_count ? selected.triangle_count.toLocaleString() : "—"}</strong></div>
              <div><Maximize2 size={13} /><span>Dimensions</span><strong>{selected.dimensions_mm.some(Boolean) ? `${selected.dimensions_mm.join(" × ")} mm` : "Calculating"}</strong></div>
              <div><Database size={13} /><span>Mesh size</span><strong>{selected.size_mb ? `${selected.size_mb} MB` : "—"}</strong></div>
            </section>
            <p className="scan-mesh-note"><Info size={13} /> Scan copies enter a project as an STL reference mesh. Converting scan geometry into clean parametric B-rep features will be a separate agent tool.</p>
          </div>
        </aside>
      )}

      {copyScan && <CopyScanDialog scan={copyScan} hierarchy={hierarchy} busy={busy} onClose={() => setCopyScan(null)} onSubmit={async (workspaceId, projectId, name) => { await onCopy(copyScan.id, workspaceId, projectId, name); setCopyScan(null); setSelectedId(null); }} />}
    </main>
  );
}

function CopyScanDialog({ scan, hierarchy, busy, onClose, onSubmit }: {
  scan: ScanAsset;
  hierarchy: HierarchyResponse;
  busy: boolean;
  onClose: () => void;
  onSubmit: (workspaceId: string, projectId: string, name: string) => Promise<void>;
}) {
  const firstWorkspace = hierarchy.workspaces.find((workspace) => workspace.projects.length > 0);
  const [workspaceId, setWorkspaceId] = useState(firstWorkspace?.id ?? "");
  const projects = useMemo(() => hierarchy.workspaces.find((workspace) => workspace.id === workspaceId)?.projects ?? [], [hierarchy, workspaceId]);
  const [projectId, setProjectId] = useState(firstWorkspace?.projects[0]?.id ?? "");
  const [name, setName] = useState(`${scan.name} scan`);

  function changeWorkspace(nextId: string) {
    setWorkspaceId(nextId);
    setProjectId(hierarchy.workspaces.find((workspace) => workspace.id === nextId)?.projects[0]?.id ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(workspaceId, projectId, name.trim());
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="copy-scan-dialog" role="dialog" aria-modal="true" aria-labelledby="copy-scan-title">
        <header><div className="entity-dialog-heading"><span className="dialog-entity-icon"><Copy size={18} /></span><div><span className="dialog-kicker">ADD TO CAD LIBRARY</span><h2 id="copy-scan-title">Copy scan to project</h2></div></div><button className="icon-button" type="button" aria-label="Close copy scan dialog" onClick={onClose}><X size={16} /></button></header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="copy-scan-source"><ScanLine size={16} /><div><span>Ready scan</span><strong>{scan.name}</strong></div><small>STL MESH</small></div>
          <div className="feature-field-row"><label className="feature-form-field"><span>Workspace</span><select aria-label="Target workspace" required value={workspaceId} onChange={(event) => changeWorkspace(event.target.value)}><option value="" disabled>Select workspace</option>{hierarchy.workspaces.filter((workspace) => workspace.projects.length > 0).map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label><label className="feature-form-field"><span>Project</span><select aria-label="Target project" required value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="" disabled>Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div>
          <label className="feature-form-field"><span>New object name</span><input aria-label="Scan object name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <p className="copy-scan-note"><Cpu size={13} /> A new object will be created with the reconstructed STL as its base reference mesh. Your original scan remains unchanged.</p>
          <footer><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy || !workspaceId || !projectId || !name.trim()}>{busy ? <LoaderCircle className="spin" size={13} /> : <FolderKanban size={13} />} Copy to project</button></footer>
        </form>
      </section>
    </div>
  );
}

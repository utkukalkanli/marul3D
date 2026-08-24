import {
  BadgeCheck,
  Box,
  Boxes,
  Check,
  CloudCog,
  Cpu,
  Download,
  KeyRound,
  LoaderCircle,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { MarketplaceExtension } from "../types";

type MarketplaceBrowserProps = {
  extensions: MarketplaceExtension[];
  busy: boolean;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onEnable: (id: string, enabled: boolean) => void;
  onConnectTrellis: (endpoint: string, token: string) => Promise<void>;
  onDisconnectTrellis: () => void;
};

export function MarketplaceBrowser({
  extensions,
  busy,
  onInstall,
  onUninstall,
  onEnable,
  onConnectTrellis,
  onDisconnectTrellis,
}: MarketplaceBrowserProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(extensions[0]?.id ?? null);
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const filtered = useMemo(
    () => extensions.filter((extension) =>
      `${extension.name} ${extension.description} ${extension.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    [extensions, query],
  );
  const selected = extensions.find((extension) => extension.id === selectedId) ?? extensions[0];

  async function connect(event: FormEvent) {
    event.preventDefault();
    setConnecting(true);
    try {
      await onConnectTrellis(endpoint, token);
      setToken("");
    } catch {
      // The application shell renders the local API error banner.
    } finally {
      setConnecting(false);
    }
  }

  return (
    <main className="marketplace-browser">
      <aside className="marketplace-sidebar">
        <div className="marketplace-side-title"><Boxes size={15} /> EXTENSIONS</div>
        <label className="marketplace-search compact">
          <Search size={13} />
          <input aria-label="Search extensions" placeholder="Search Marketplace" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <nav>
          <button className="selected" type="button"><CloudCog size={14} /> Marketplace <span>{extensions.length}</span></button>
          <button type="button"><Download size={14} /> Installed <span>{extensions.filter((item) => item.installed).length}</span></button>
        </nav>
        <div className="marketplace-category">
          <small>CATEGORIES</small>
          <button type="button"><Cpu size={13} /> AI Modeling</button>
          <button type="button" disabled><Box size={13} /> CAD Importers</button>
          <button type="button" disabled><ShieldCheck size={13} /> Validation</button>
        </div>
      </aside>

      <section className="marketplace-content">
        <header className="marketplace-hero">
          <span>MARUL3D MARKETPLACE</span>
          <h1>Extend your CAD workspace</h1>
          <p>Install constrained modeling tools without giving extensions shell or unrestricted file access.</p>
          <label className="marketplace-search hero-search">
            <Search size={17} />
            <input aria-label="Search Marketplace" placeholder="Search extensions, tools, and providers" value={query} onChange={(event) => setQuery(event.target.value)} />
            <kbd>⌘ K</kbd>
          </label>
        </header>

        <div className="marketplace-section-heading"><div><strong>Featured extensions</strong><span>Curated for marul3D</span></div><small>{filtered.length} RESULT</small></div>
        <section className="extension-grid" aria-label="Marketplace extensions">
          {filtered.map((extension) => (
            <article className={`extension-card ${selected?.id === extension.id ? "selected" : ""}`} key={extension.id} onClick={() => setSelectedId(extension.id)}>
              <div className="trellis-extension-icon"><span>T</span><i /></div>
              <div className="extension-copy">
                <div><h2>{extension.name}</h2>{extension.verified && <BadgeCheck size={14} aria-label="Verified publisher" />}</div>
                <small>{extension.publisher} · v{extension.version}</small>
                <p>{extension.description}</p>
                <div className="extension-tags">{extension.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
              </div>
              <div className="extension-card-actions">
                {extension.installed ? (
                  <span className={`installed-state ${extension.enabled ? "enabled" : ""}`}><Check size={12} /> Installed</span>
                ) : (
                  <button type="button" className="primary-button" disabled={busy} onClick={(event) => { event.stopPropagation(); onInstall(extension.id); }}><Download size={13} /> Install</button>
                )}
              </div>
            </article>
          ))}
        </section>
      </section>

      {selected && (
        <aside className="extension-details">
          <header>
            <div className="trellis-extension-icon large"><span>T</span><i /></div>
            <button type="button" className="icon-button" aria-label="Close extension details" onClick={() => setSelectedId(null)}><X size={15} /></button>
          </header>
          <div className="extension-detail-title">
            <span>{selected.category}</span>
            <h2>{selected.name}</h2>
            <p>{selected.publisher} {selected.verified && <BadgeCheck size={13} />} · v{selected.version}</p>
          </div>
          <p className="extension-detail-description">{selected.description}</p>

          {!selected.installed ? (
            <button type="button" className="primary-button extension-install" disabled={busy} onClick={() => onInstall(selected.id)}><Download size={14} /> Install extension</button>
          ) : (
            <div className="extension-management">
              <div className="extension-status-row">
                <span className={selected.enabled ? "ready" : ""}><Power size={13} /> {selected.enabled ? "Enabled" : "Disabled"}</span>
                <button type="button" className="secondary-button" onClick={() => onEnable(selected.id, !selected.enabled)}>{selected.enabled ? "Disable" : "Enable"}</button>
                <button type="button" className="extension-trash" aria-label="Uninstall TRELLIS.2" onClick={() => onUninstall(selected.id)}><Trash2 size={14} /></button>
              </div>
              {selected.authenticated ? (
                <div className="trellis-connected">
                  <span><Check size={14} /></span>
                  <div><strong>Remote worker connected</strong><small>{selected.endpoint}</small><p>API token secured in macOS Keychain.</p></div>
                  <button type="button" onClick={onDisconnectTrellis}>Disconnect</button>
                </div>
              ) : (
                <form className="trellis-connect-form" onSubmit={connect}>
                  <div className="connect-heading"><KeyRound size={15} /><div><strong>Connect TRELLIS worker</strong><small>Endpoint + token authentication</small></div></div>
                  <label><span>HTTPS endpoint</span><input aria-label="TRELLIS endpoint" type="url" placeholder="https://gpu.example.com" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} /></label>
                  <label><span>API token</span><input aria-label="TRELLIS API token" type="password" autoComplete="off" placeholder="Stored in Keychain" value={token} onChange={(event) => setToken(event.target.value)} /></label>
                  <p>TRELLIS.2 needs a Linux NVIDIA worker. marul3D sends only the image you choose to this endpoint.</p>
                  <button className="primary-button" type="submit" disabled={connecting || endpoint.length < 8 || token.length < 8}>{connecting ? <LoaderCircle className="spin" size={14} /> : <KeyRound size={13} />} Connect securely</button>
                </form>
              )}
            </div>
          )}

          <section className="extension-detail-section">
            <h3>Capabilities</h3>
            {selected.capabilities.map((capability) => <div className="detail-list-item" key={capability}><Check size={12} /><span>{capability}</span></div>)}
          </section>
          <section className="extension-detail-section permissions">
            <h3>Requested permissions</h3>
            {selected.permissions.map((permission) => <div className="permission-item" key={permission.id}><ShieldCheck size={13} /><div><strong>{permission.label}</strong><p>{permission.description}</p></div></div>)}
          </section>
        </aside>
      )}
    </main>
  );
}

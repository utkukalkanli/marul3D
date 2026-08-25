import {
  Check,
  CircleDollarSign,
  Cloud,
  CreditCard,
  KeyRound,
  LockKeyhole,
  Palette,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";

export type ThemeId = "marul" | "cyberpunk" | "aerospace" | "kawaii";
export type ThemePreference = ThemeId | "adaptive";

type SettingsSection = "account" | "usage" | "billing" | "appearance";
type AuthMode = "signin" | "signup";

const themes: { id: ThemePreference; name: string; description: string; colors: string[] }[] = [
  { id: "adaptive", name: "Adaptive", description: "Follows the kind of CAD work in view", colors: ["#a9dc67", "#60c7ff", "#ff8ccf"] },
  { id: "marul", name: "Marul", description: "Focused workshop green", colors: ["#a9dc67", "#24301d", "#111311"] },
  { id: "aerospace", name: "Aerospace", description: "Flight deck blue and amber", colors: ["#58b9ff", "#f1a84b", "#0b1420"] },
  { id: "cyberpunk", name: "Cyberpunk", description: "Neon cyan and magenta", colors: ["#31f5ff", "#ff4dc4", "#0c0914"] },
  { id: "kawaii", name: "Kawaii", description: "Soft candy studio", colors: ["#ff8ccf", "#9b8cff", "#211727"] },
];

export function SettingsDialog({
  configured,
  theme,
  resolvedTheme,
  projectContext,
  agentRequestCount,
  onThemeChange,
  onClose,
  onSave,
}: {
  configured: boolean;
  theme: ThemePreference;
  resolvedTheme: ThemeId;
  projectContext: string;
  agentRequestCount: number;
  onThemeChange: (theme: ThemePreference) => void;
  onClose: () => void;
  onSave: (apiKey: string) => Promise<void>;
}) {
  const [section, setSection] = useState<SettingsSection>("account");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitApiKey(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await onSave(apiKey);
      setApiKey("");
      setNotice("OpenAI key saved securely in macOS Keychain.");
    } finally {
      setSaving(false);
    }
  }

  function explainHostedBoundary(kind: "auth" | "stripe") {
    setNotice(kind === "auth"
      ? "Cloud identity is not connected in the local MVP. No account credentials were sent or stored."
      : "Stripe Checkout activates with the hosted account service. The local MVP has not created a payment session.");
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-dialog settings-hub" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-header">
          <div><span className="dialog-kicker">MARUL3D CONTROL CENTER</span><h2>Settings</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings"><X size={18} /></button>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            <button className={section === "account" ? "selected" : ""} type="button" onClick={() => { setSection("account"); setNotice(null); }}><UserRound size={15} /><span>Account</span></button>
            <button className={section === "usage" ? "selected" : ""} type="button" onClick={() => { setSection("usage"); setNotice(null); }}><KeyRound size={15} /><span>Usage & API</span></button>
            <button className={section === "billing" ? "selected" : ""} type="button" onClick={() => { setSection("billing"); setNotice(null); }}><CreditCard size={15} /><span>Billing</span></button>
            <button className={section === "appearance" ? "selected" : ""} type="button" onClick={() => { setSection("appearance"); setNotice(null); }}><Palette size={15} /><span>Appearance</span></button>
            <div className="settings-local-note"><LockKeyhole size={13} /><span>CAD data stays local</span></div>
          </nav>

          <main className="settings-content">
            {section === "account" && (
              <div className="settings-section">
                <div className="settings-section-heading"><span>ACCOUNT</span><h3>Your marul3D identity</h3><p>One account will connect desktop, mobile scans, marketplace purchases, and subscriptions.</p></div>
                <div className="account-state-card"><div className="account-avatar"><UserRound size={20} /></div><div><strong>Local workspace</strong><span>Not signed in · Files and history are stored only on this Mac</span></div><span className="settings-badge local">LOCAL</span></div>
                <div className="auth-actions"><button className="primary-button" type="button" onClick={() => setAuthMode("signin")}>Sign in</button><button className="secondary-button" type="button" onClick={() => setAuthMode("signup")}>Create account</button></div>
                {authMode && (
                  <form className="auth-preview-form" onSubmit={(event) => { event.preventDefault(); explainHostedBoundary("auth"); }}>
                    <div className="inline-heading"><Cloud size={15} /><div><strong>{authMode === "signin" ? "Sign in to marul3D" : "Create your marul3D account"}</strong><small>Cloud account beta</small></div></div>
                    <label><span>Email</span><input type="email" autoComplete="email" placeholder="you@company.com" required /></label>
                    <label><span>Password</span><input type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} placeholder="••••••••••••" required minLength={8} /></label>
                    <button className="primary-button" type="submit">Continue</button>
                  </form>
                )}
                <div className="settings-info-row"><Cloud size={15} /><div><strong>Cross-device sync boundary</strong><p>Account metadata, purchases, subscriptions, and future mobile scans can sync. CAD source files remain local unless you explicitly publish or sync them.</p></div></div>
              </div>
            )}

            {section === "usage" && (
              <div className="settings-section">
                <div className="settings-section-heading"><span>USAGE & API</span><h3>Models, credits, and credentials</h3><p>Use your own provider key now; hosted marul3D credits become available with cloud accounts.</p></div>
                <div className="usage-grid"><div className="metric-card"><span>CURRENT OBJECT</span><strong>{agentRequestCount}</strong><small>agent prompts in local history</small></div><div className="metric-card"><span>MARUL3D CREDITS</span><strong>—</strong><small>available after sign-in</small></div><div className="metric-card"><span>PROVIDER BILLING</span><strong>BYOK</strong><small>metered by OpenAI</small></div></div>
                <div className="usage-meter"><div><strong>Hosted credit wallet</strong><span>Requires a marul3D cloud account</span></div><div className="usage-track"><i style={{ width: "0%" }} /></div><small>0 of 0 credits available in local mode</small></div>
                <form className="api-key-card" onSubmit={submitApiKey}>
                  <div className="api-key-title"><span className={`connection-led ${configured ? "connected" : ""}`} /><div><strong>OpenAI</strong><small>{configured ? "Connected through macOS Keychain" : "API key not configured"}</small></div><span className={`settings-badge ${configured ? "ready" : ""}`}>{configured ? "READY" : "SETUP"}</span></div>
                  <label className="key-field"><span>API key</span><div><KeyRound size={16} /><input type="password" autoComplete="off" placeholder={configured ? "Replace the saved key" : "sk-…"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></div></label>
                  <p>Saved by the local Python service in macOS Keychain. It is never returned to this browser or written to a project.</p>
                  <button className="primary-button" disabled={apiKey.length < 8 || saving} type="submit">{saving ? "Saving…" : "Save securely"}</button>
                </form>
                <p className="provider-billing-note">OpenAI does not expose account credit balance through a normal project API key. Exact spend and limits remain in the provider dashboard; marul3D only reports usage it can measure locally.</p>
              </div>
            )}

            {section === "billing" && (
              <div className="settings-section">
                <div className="settings-section-heading"><span>BILLING</span><h3>Plans that grow with your workflow</h3><p>Local CAD remains available without a subscription. Paid plans add hosted agents, sync, and marketplace services.</p></div>
                <div className="plan-summary"><div><span>CURRENT PLAN</span><strong>Local Free</strong><small>No renewal date · €0/month</small></div><span className="settings-badge ready">ACTIVE</span></div>
                <div className="plan-grid">
                  <article className="plan-card current"><span>LOCAL</span><h4>Free</h4><strong>€0 <small>/ month</small></strong><ul><li><Check size={13} /> Local parametric CAD</li><li><Check size={13} /> Bring your own API key</li><li><Check size={13} /> Local checkpoints</li></ul><button className="secondary-button" disabled type="button">Current plan</button></article>
                  <article className="plan-card featured"><span>PRO</span><h4>Professional</h4><strong>TBD <small>at cloud launch</small></strong><ul><li><Check size={13} /> Hosted AI credits</li><li><Check size={13} /> Desktop + mobile sync</li><li><Check size={13} /> Marketplace seller tools</li></ul><button className="primary-button" type="button" onClick={() => explainHostedBoundary("stripe")}><CircleDollarSign size={14} /> Upgrade with Stripe</button></article>
                </div>
                <div className="stripe-note"><CreditCard size={16} /><div><strong>Stripe-hosted checkout</strong><p>Card data will go directly to Stripe. marul3D will store only Stripe customer/subscription IDs in the hosted account service—not on this local CAD backend.</p></div></div>
              </div>
            )}

            {section === "appearance" && (
              <div className="settings-section">
                <div className="settings-section-heading"><span>APPEARANCE</span><h3>A workspace that fits the work</h3><p>Choose a fixed visual language or let marul3D adapt to the selected design context.</p></div>
                <div className="adaptive-context"><Sparkles size={16} /><div><strong>Current context</strong><span>{projectContext}</span></div><em>Adaptive → {resolvedTheme}</em></div>
                <div className="theme-grid">
                  {themes.map((item) => <button key={item.id} className={`theme-card ${theme === item.id ? "selected" : ""}`} type="button" aria-label={`${item.name} theme`} onClick={() => onThemeChange(item.id)}><span className="theme-swatch">{item.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><span><strong>{item.name}</strong><small>{item.description}</small></span>{theme === item.id && <Check size={15} />}</button>)}
                </div>
                <p className="adaptive-explanation">Adaptive mode currently uses transparent local heuristics from workspace, project, object, and feature names. Aerospace terms select the flight-deck theme; toy, character, or Labubu work selects Kawaii; robotics and futuristic concepts select Cyberpunk. No document content is uploaded for theme selection.</p>
              </div>
            )}

            {notice && <div className="settings-notice" role="status">{notice}</div>}
          </main>
        </div>
      </section>
    </div>
  );
}

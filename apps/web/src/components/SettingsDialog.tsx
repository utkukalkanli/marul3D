import { KeyRound, X } from "lucide-react";
import { FormEvent, useState } from "react";

export function SettingsDialog({
  configured,
  onClose,
  onSave,
}: {
  configured: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(apiKey);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-dialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <div>
            <span className="dialog-kicker">MODEL PROVIDERS</span>
            <h2>OpenAI connection</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <label className="key-field">
            <span>API key</span>
            <div>
              <KeyRound size={16} />
              <input
                autoFocus
                type="password"
                autoComplete="off"
                placeholder={configured ? "Replace the saved key" : "sk-…"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
          </label>
          <p>
            Saved by the local Python service in macOS Keychain. The key is never returned to this browser or
            written to the project.
          </p>
          <footer>
            <span className={`connection-state ${configured ? "connected" : ""}`}>
              {configured ? "Configured in Keychain" : "Not configured"}
            </span>
            <button className="primary-button" disabled={apiKey.length < 8 || saving} type="submit">
              {saving ? "Saving…" : "Save securely"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

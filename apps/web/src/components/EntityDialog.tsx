import { AlertTriangle, Box, Folder, Layers3, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

export type EntityDialogRequest =
  | {
      kind: "name";
      entity: "workspace" | "project" | "object";
      title: string;
      label: string;
      initialValue: string;
      submitLabel: string;
      onSubmit: (value: string) => void;
    }
  | {
      kind: "delete";
      entity: "workspace" | "project" | "object";
      title: string;
      description: string;
      submitLabel: string;
      onSubmit: () => void;
    };

const entityCopy = {
  workspace: { kicker: "WORKSPACE", icon: Layers3 },
  project: { kicker: "PROJECT", icon: Folder },
  object: { kicker: "CAD OBJECT", icon: Box },
};

export function EntityDialog({
  request,
  onClose,
}: {
  request: EntityDialogRequest;
  onClose: () => void;
}) {
  const [value, setValue] = useState(request.kind === "name" ? request.initialValue : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = entityCopy[request.entity];
  const Icon = request.kind === "delete" ? AlertTriangle : copy.icon;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    inputRef.current?.select();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (request.kind === "name") {
      const name = value.trim();
      if (!name) return;
      request.onSubmit(name);
    } else {
      request.onSubmit();
    }
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`entity-dialog ${request.kind === "delete" ? "danger-dialog" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="entity-dialog-heading">
            <span className="dialog-entity-icon"><Icon size={18} /></span>
            <div>
              <span className="dialog-kicker">{request.kind === "delete" ? "CONFIRM DELETE" : copy.kicker}</span>
              <h2 id="entity-dialog-title">{request.title}</h2>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit}>
          {request.kind === "name" ? (
            <label className="entity-name-field">
              <span>{request.label}</span>
              <input
                ref={inputRef}
                autoFocus
                aria-label={request.label}
                value={value}
                maxLength={120}
                onChange={(event) => setValue(event.target.value)}
              />
              <small>Press Enter to save · Esc to cancel</small>
            </label>
          ) : (
            <p className="delete-description">{request.description}</p>
          )}

          <footer>
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button
              className={request.kind === "delete" ? "danger-button" : "primary-button"}
              type="submit"
              disabled={request.kind === "name" && !value.trim()}
            >
              {request.submitLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

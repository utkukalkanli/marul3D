import { CircleDot, GitBranch, MoveUp, Radius, SquareDashed, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { Feature } from "../types";

type NewFeatureKind = "sketch" | "extrude" | "hole_pattern" | "fillet";

const choices: { kind: NewFeatureKind; label: string; description: string; icon: typeof GitBranch }[] = [
  { kind: "sketch", label: "Sketch", description: "Rectangle or circle profile", icon: SquareDashed },
  { kind: "extrude", label: "Extrude", description: "Turn a sketch into a solid", icon: MoveUp },
  { kind: "hole_pattern", label: "Hole", description: "Cut a parametric hole", icon: CircleDot },
  { kind: "fillet", label: "Fillet", description: "Round solid edges", icon: Radius },
];

function featureId(kind: NewFeatureKind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function FeatureDialog({
  features,
  onClose,
  onCreate,
}: {
  features: Feature[];
  onClose: () => void;
  onCreate: (feature: Feature) => void;
}) {
  const [kind, setKind] = useState<NewFeatureKind>("sketch");
  const [name, setName] = useState("Base sketch");
  const [profile, setProfile] = useState<"rectangle" | "circle">("rectangle");
  const [plane, setPlane] = useState<"XY" | "XZ" | "YZ">("XY");
  const [operation, setOperation] = useState<"new" | "add" | "cut">("add");
  const [symmetric, setSymmetric] = useState(false);
  const [primary, setPrimary] = useState(40);
  const [secondary, setSecondary] = useState(24);
  const sketches = features.filter((feature) => feature.type === "sketch");
  const solidParents = features.filter((feature) => feature.type !== "sketch");
  const defaultParent = useMemo(
    () => kind === "extrude" ? sketches.at(-1)?.id : solidParents.at(-1)?.id,
    [kind, sketches, solidParents],
  );
  const [parentOverride, setParentOverride] = useState("");
  const parentId = parentOverride || defaultParent || "";

  function choose(next: NewFeatureKind) {
    setKind(next);
    setParentOverride("");
    if (next === "sketch") {
      setName("New sketch"); setPrimary(40); setSecondary(24);
    } else if (next === "extrude") {
      setName("Extrude"); setPrimary(10);
      setOperation(solidParents.length ? "add" : "new");
    } else if (next === "hole_pattern") {
      setName("Hole"); setPrimary(5);
    } else {
      setName("Edge fillet"); setPrimary(1.5);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const base = { id: featureId(kind), name: name.trim(), enabled: true };
    if (kind === "sketch") {
      onCreate({
        ...base,
        type: "sketch",
        depends_on: [],
        plane,
        profile,
        width: primary,
        height: secondary,
        radius: primary,
        origin_x: 0,
        origin_y: 0,
        origin_z: 0,
      });
    } else if (kind === "extrude") {
      onCreate({
        ...base,
        type: "extrude",
        depends_on: [parentId],
        sketch_id: parentId,
        distance: primary,
        operation,
        symmetric,
      });
    } else if (kind === "hole_pattern") {
      onCreate({
        ...base,
        type: "hole_pattern",
        depends_on: [parentId],
        diameter: primary,
        points: [{ x: 0, y: 0 }],
        depth: null,
      });
    } else {
      onCreate({
        ...base,
        type: "fillet",
        depends_on: [parentId],
        radius: primary,
        selector: "vertical",
      });
    }
    onClose();
  }

  const needsParent = kind !== "sketch";
  const parentOptions = kind === "extrude" ? sketches : solidParents;
  const canSubmit = Boolean(name.trim()) && primary > 0 && (!needsParent || Boolean(parentId));

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="feature-dialog" role="dialog" aria-modal="true" aria-labelledby="feature-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div className="entity-dialog-heading">
            <span className="dialog-entity-icon"><GitBranch size={18} /></span>
            <div><span className="dialog-kicker">PARAMETRIC HISTORY</span><h2 id="feature-dialog-title">Add feature</h2></div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="feature-kind-grid">
            {choices.map((choice) => {
              const Icon = choice.icon;
              return <button key={choice.kind} className={kind === choice.kind ? "selected" : ""} type="button" onClick={() => choose(choice.kind)}><Icon size={17} /><span><strong>{choice.label}</strong><small>{choice.description}</small></span></button>;
            })}
          </div>
          <label className="feature-form-field"><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
          {kind === "sketch" && <div className="feature-field-row">
            <label className="feature-form-field"><span>Profile</span><select value={profile} onChange={(event) => setProfile(event.target.value as "rectangle" | "circle")}><option value="rectangle">Rectangle</option><option value="circle">Circle</option></select></label>
            <label className="feature-form-field"><span>Plane</span><select value={plane} onChange={(event) => setPlane(event.target.value as "XY" | "XZ" | "YZ")}><option>XY</option><option>XZ</option><option>YZ</option></select></label>
          </div>}
          {needsParent && <label className="feature-form-field"><span>{kind === "extrude" ? "Source sketch" : "Parent feature"}</span><select value={parentId} onChange={(event) => setParentOverride(event.target.value)}>{parentOptions.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select>{!parentOptions.length && <small className="field-error">Add {kind === "extrude" ? "a sketch" : "a solid feature"} first.</small>}</label>}
          {kind === "extrude" && <div className="feature-field-row">
            <label className="feature-form-field"><span>Operation</span><select value={operation} onChange={(event) => setOperation(event.target.value as "new" | "add" | "cut")}><option value="new">New body</option><option value="add">Add material</option><option value="cut">Cut material</option></select></label>
            <label className="feature-checkbox"><input type="checkbox" checked={symmetric} onChange={(event) => setSymmetric(event.target.checked)} /><span>Symmetric extrusion</span></label>
          </div>}
          <div className="feature-field-row">
            <label className="feature-form-field"><span>{kind === "sketch" ? profile === "circle" ? "Radius" : "Width" : kind === "extrude" ? "Distance" : kind === "hole_pattern" ? "Diameter" : "Radius"}</span><div className="dialog-number"><input type="number" min="0.001" step="0.1" value={primary} onChange={(event) => setPrimary(Number(event.target.value))} /><em>mm</em></div></label>
            {kind === "sketch" && profile === "rectangle" && <label className="feature-form-field"><span>Height</span><div className="dialog-number"><input type="number" min="0.001" step="0.1" value={secondary} onChange={(event) => setSecondary(Number(event.target.value))} /><em>mm</em></div></label>}
          </div>
          <footer><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={!canSubmit}>Add feature</button></footer>
        </form>
      </section>
    </div>
  );
}

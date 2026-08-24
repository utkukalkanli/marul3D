import {
  Box,
  CircleDot,
  Code2,
  Cylinder,
  FileBox,
  FolderOpen,
  Radius,
} from "lucide-react";
import type { Feature } from "../types";

const icons = {
  box: Box,
  cylinder: Cylinder,
  hole_pattern: CircleDot,
  fillet: Radius,
  import_step: FileBox,
  import_stl: FileBox,
  custom_cadquery: Code2,
};

export function FeatureTree({
  name,
  features,
  selectedId,
  onSelect,
}: {
  name: string;
  features: Feature[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="explorer-panel">
      <div className="panel-heading">EXPLORER</div>
      <div className="project-heading">
        <FolderOpen size={15} />
        <span>{name}</span>
      </div>
      <div className="tree-label">FEATURE HISTORY</div>
      <div className="feature-tree">
        {features.map((feature, index) => {
          const Icon = icons[feature.type];
          return (
            <button
              type="button"
              className={`feature-row ${selectedId === feature.id ? "selected" : ""}`}
              key={feature.id}
              onClick={() => onSelect(feature.id)}
            >
              <span className="feature-index">{index + 1}</span>
              <Icon size={15} strokeWidth={1.8} />
              <span className="feature-name">{feature.name}</span>
              {!feature.enabled && <span className="feature-disabled">off</span>}
            </button>
          );
        })}
      </div>
      <div className="tree-footer">{features.length} parametric features</div>
    </aside>
  );
}

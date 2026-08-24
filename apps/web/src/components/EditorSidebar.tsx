import {
  Box,
  Boxes,
  CircleDot,
  Code2,
  Cylinder,
  Eye,
  EyeOff,
  FileBox,
  FolderOpen,
  GripVertical,
  MoveUp,
  PanelLeftClose,
  Plus,
  Radius,
  Redo2,
  Undo2,
  SquareDashed,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Feature, HierarchyResponse, ObjectRef } from "../types";

const icons = {
  box: Box,
  cylinder: Cylinder,
  hole_pattern: CircleDot,
  fillet: Radius,
  import_step: FileBox,
  import_stl: FileBox,
  custom_cadquery: Code2,
  sketch: SquareDashed,
  extrude: MoveUp,
};

function dependencies(feature: Feature) {
  return feature.type === "extrude"
    ? [...new Set([...(feature.depends_on ?? []), feature.sketch_id])]
    : feature.depends_on ?? [];
}

function featureDepth(feature: Feature, features: Feature[], visited = new Set<string>()): number {
  if (visited.has(feature.id)) return 0;
  visited.add(feature.id);
  const parent = features.find((item) => dependencies(feature).includes(item.id));
  return parent ? Math.min(3, 1 + featureDepth(parent, features, visited)) : 0;
}

export function EditorSidebar({
  hierarchy,
  selection,
  features,
  selectedId,
  disabled,
  onSelectObject,
  onSelectFeature,
  onToggle,
  onUndo,
  onRedo,
  onAdd,
  onDelete,
  onToggleSuppressed,
  onReorder,
}: {
  hierarchy: HierarchyResponse;
  selection: ObjectRef;
  features: Feature[];
  selectedId: string | null;
  disabled: boolean;
  onSelectObject: (ref: ObjectRef) => void;
  onSelectFeature: (id: string) => void;
  onToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAdd: () => void;
  onDelete: (feature: Feature) => void;
  onToggleSuppressed: (feature: Feature) => void;
  onReorder: (sourceId: string, targetId: string) => void;
}) {
  return (
    <aside className="explorer-panel editor-sidebar">
      <div className="panel-heading explorer-heading">
        <span>CAD EXPLORER</span>
        <button
          className="panel-action"
          type="button"
          aria-label="Close CAD explorer"
          title="Close CAD explorer"
          onClick={onToggle}
        >
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="compact-tree">
        {hierarchy.workspaces.map((workspace) => (
          <div className="compact-workspace" key={workspace.id}>
            <div className="compact-label workspace-label"><Boxes size={13} /><span>{workspace.name}</span></div>
            {workspace.projects.map((project) => (
              <div key={project.id}>
                <div className="compact-label project-label"><FolderOpen size={13} /><span>{project.name}</span></div>
                {project.objects.map((cadObject) => {
                  const ref = {
                    workspaceId: workspace.id,
                    projectId: project.id,
                    objectId: cadObject.id,
                  };
                  return (
                    <button
                      type="button"
                      className={`compact-object ${selection.objectId === cadObject.id ? "selected" : ""}`}
                      key={cadObject.id}
                      disabled={disabled}
                      onClick={() => onSelectObject(ref)}
                    >
                      <Box size={12} />
                      <span>{cadObject.name}</span>
                      <small>r{cadObject.revision}</small>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="tree-label feature-divider feature-history-heading">
        <span>FEATURE HISTORY</span>
        <div className="feature-history-actions">
          <button className="panel-action" type="button" aria-label="Add feature" title="Add feature" disabled={disabled} onClick={onAdd}><Plus size={14} /></button>
          <button
            className="panel-action"
            type="button"
            aria-label="Undo"
            title="Undo document revision"
            disabled={disabled}
            onClick={onUndo}
          >
            <Undo2 size={14} />
          </button>
          <button
            className="panel-action"
            type="button"
            aria-label="Redo"
            title="Redo document revision"
            disabled={disabled}
            onClick={onRedo}
          >
            <Redo2 size={14} />
          </button>
        </div>
      </div>
      <div className="feature-tree editor-features">
        {features.map((feature, index) => {
          const Icon = icons[feature.type];
          const depth = featureDepth(feature, features);
          return (
            <div
              className={`feature-row ${selectedId === feature.id ? "selected" : ""} ${!feature.enabled ? "suppressed" : ""}`}
              key={feature.id}
              draggable={!disabled}
              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/feature-id", feature.id); }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
              onDrop={(event) => { event.preventDefault(); const sourceId = event.dataTransfer.getData("text/feature-id"); if (sourceId && sourceId !== feature.id) onReorder(sourceId, feature.id); }}
              style={{ "--feature-depth": depth } as CSSProperties}
            >
              <GripVertical className="feature-grip" size={13} />
              <button type="button" className="feature-select" onClick={() => onSelectFeature(feature.id)}>
                <span className="feature-index">{index + 1}</span><Icon size={15} strokeWidth={1.8} /><span className="feature-name">{feature.name}</span>
              </button>
              <div className="feature-row-actions">
                <button type="button" aria-label={`${feature.enabled ? "Suppress" : "Unsuppress"} ${feature.name}`} title={feature.enabled ? "Suppress feature and children" : "Unsuppress feature"} disabled={disabled} onClick={() => onToggleSuppressed(feature)}>{feature.enabled ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                <button type="button" aria-label={`Delete ${feature.name}`} title="Delete feature" disabled={disabled} onClick={() => onDelete(feature)}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="tree-footer">{features.length} parametric features</div>
    </aside>
  );
}

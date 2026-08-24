import {
  Box,
  Boxes,
  CircleDot,
  Code2,
  Cylinder,
  FileBox,
  FolderOpen,
  PanelLeftClose,
  Radius,
  Redo2,
  Undo2,
} from "lucide-react";
import type { Feature, HierarchyResponse, ObjectRef } from "../types";

const icons = {
  box: Box,
  cylinder: Cylinder,
  hole_pattern: CircleDot,
  fillet: Radius,
  import_step: FileBox,
  import_stl: FileBox,
  custom_cadquery: Code2,
};

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
          return (
            <button
              type="button"
              className={`feature-row ${selectedId === feature.id ? "selected" : ""}`}
              key={feature.id}
              onClick={() => onSelectFeature(feature.id)}
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

import {
  Box,
  Boxes,
  CircleDot,
  Code2,
  Cylinder,
  FileBox,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
  Radius,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Feature, HierarchyResponse, ObjectRef } from "../types";

const featureIcons = {
  box: Box,
  cylinder: Cylinder,
  hole_pattern: CircleDot,
  fillet: Radius,
  import_step: FileBox,
  import_stl: FileBox,
  custom_cadquery: Code2,
};

type ExplorerProps = {
  hierarchy: HierarchyResponse;
  selection: ObjectRef | null;
  features: Feature[];
  selectedFeatureId: string | null;
  disabled: boolean;
  onSelectObject: (ref: ObjectRef) => void;
  onSelectFeature: (id: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (id: string, currentName: string) => void;
  onDeleteWorkspace: (id: string, name: string) => void;
  onCreateProject: (workspaceId: string) => void;
  onRenameProject: (workspaceId: string, projectId: string, currentName: string) => void;
  onDeleteProject: (workspaceId: string, projectId: string, name: string) => void;
  onCreateObject: (workspaceId: string, projectId: string) => void;
  onRenameObject: (ref: ObjectRef, currentName: string) => void;
  onDeleteObject: (ref: ObjectRef, name: string) => void;
};

function ActionButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tree-action"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function WorkspaceExplorer(props: ExplorerProps) {
  return (
    <aside className="explorer-panel">
      <div className="panel-heading explorer-heading">
        <span>WORKSPACES</span>
        <ActionButton label="Create workspace" disabled={props.disabled} onClick={props.onCreateWorkspace}>
          <Plus size={13} />
        </ActionButton>
      </div>
      <div className="hierarchy-tree">
        {props.hierarchy.workspaces.map((workspace) => (
          <div className="workspace-node" key={workspace.id}>
            <div className="entity-row workspace-row">
              <Boxes size={14} />
              <span>{workspace.name}</span>
              <div className="entity-actions">
                <ActionButton label={`Create project in ${workspace.name}`} disabled={props.disabled} onClick={() => props.onCreateProject(workspace.id)}><Plus size={12} /></ActionButton>
                <ActionButton label={`Rename workspace ${workspace.name}`} disabled={props.disabled} onClick={() => props.onRenameWorkspace(workspace.id, workspace.name)}><Pencil size={11} /></ActionButton>
                <ActionButton label={`Delete workspace ${workspace.name}`} disabled={props.disabled} onClick={() => props.onDeleteWorkspace(workspace.id, workspace.name)}><Trash2 size={11} /></ActionButton>
              </div>
            </div>
            {workspace.projects.map((project) => (
              <div className="project-node" key={project.id}>
                <div className="entity-row project-row">
                  <FolderOpen size={14} />
                  <span>{project.name}</span>
                  <div className="entity-actions">
                    <ActionButton label={`Create object in ${project.name}`} disabled={props.disabled} onClick={() => props.onCreateObject(workspace.id, project.id)}><Plus size={12} /></ActionButton>
                    <ActionButton label={`Rename project ${project.name}`} disabled={props.disabled} onClick={() => props.onRenameProject(workspace.id, project.id, project.name)}><Pencil size={11} /></ActionButton>
                    <ActionButton label={`Delete project ${project.name}`} disabled={props.disabled} onClick={() => props.onDeleteProject(workspace.id, project.id, project.name)}><Trash2 size={11} /></ActionButton>
                  </div>
                </div>
                {project.objects.map((cadObject) => {
                  const ref = { workspaceId: workspace.id, projectId: project.id, objectId: cadObject.id };
                  const selected = props.selection?.objectId === cadObject.id;
                  return (
                    <div className={`entity-row object-row ${selected ? "selected" : ""}`} key={cadObject.id}>
                      <button
                        type="button"
                        className="object-select"
                        disabled={props.disabled}
                        onClick={() => props.onSelectObject(ref)}
                      >
                        <Box size={13} />
                        <span>{cadObject.name}</span>
                        <small>r{cadObject.revision}</small>
                      </button>
                      <div className="entity-actions">
                        <ActionButton label={`Rename object ${cadObject.name}`} disabled={props.disabled} onClick={() => props.onRenameObject(ref, cadObject.name)}><Pencil size={11} /></ActionButton>
                        <ActionButton label={`Delete object ${cadObject.name}`} disabled={props.disabled} onClick={() => props.onDeleteObject(ref, cadObject.name)}><Trash2 size={11} /></ActionButton>
                      </div>
                    </div>
                  );
                })}
                {project.objects.length === 0 && <div className="empty-node"><Folder size={12} /> No objects</div>}
              </div>
            ))}
            {workspace.projects.length === 0 && <div className="empty-node workspace-empty">No projects</div>}
          </div>
        ))}
        {props.hierarchy.workspaces.length === 0 && <div className="empty-hierarchy">Create a workspace to begin.</div>}
      </div>

      <div className="tree-label feature-divider">FEATURE HISTORY</div>
      <div className="feature-tree hierarchy-features">
        {props.features.map((feature, index) => {
          const Icon = featureIcons[feature.type];
          return (
            <button
              type="button"
              className={`feature-row ${props.selectedFeatureId === feature.id ? "selected" : ""}`}
              key={feature.id}
              onClick={() => props.onSelectFeature(feature.id)}
            >
              <span className="feature-index">{index + 1}</span>
              <Icon size={15} strokeWidth={1.8} />
              <span className="feature-name">{feature.name}</span>
              {!feature.enabled && <span className="feature-disabled">off</span>}
            </button>
          );
        })}
        {!props.selection && <div className="empty-node">Select a CAD object</div>}
      </div>
      <div className="tree-footer">{props.features.length} parametric features</div>
    </aside>
  );
}

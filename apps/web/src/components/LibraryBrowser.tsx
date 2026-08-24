import {
  ArrowRight,
  Box,
  Boxes,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { HierarchyResponse, ObjectRef } from "../types";

type LibraryProps = {
  hierarchy: HierarchyResponse;
  disabled: boolean;
  onSelectObject: (ref: ObjectRef) => void;
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

function CardActions({
  renameLabel,
  deleteLabel,
  disabled,
  onRename,
  onDelete,
}: {
  renameLabel: string;
  deleteLabel: string;
  disabled: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card-actions">
      <button
        type="button"
        aria-label={renameLabel}
        title={renameLabel}
        disabled={disabled}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRename();
        }}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        aria-label={deleteLabel}
        title={deleteLabel}
        disabled={disabled}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function CreateCard({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="library-card create-card" disabled={disabled} onClick={onClick}>
      <span className="create-icon"><Plus size={22} /></span>
      <strong>{label}</strong>
    </button>
  );
}

export function LibraryBrowser(props: LibraryProps) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const workspace = useMemo(
    () => props.hierarchy.workspaces.find((item) => item.id === workspaceId) ?? null,
    [props.hierarchy, workspaceId],
  );
  const project = useMemo(
    () => workspace?.projects.find((item) => item.id === projectId) ?? null,
    [workspace, projectId],
  );

  useEffect(() => {
    if (workspaceId && !workspace) {
      setWorkspaceId(null);
      setProjectId(null);
    } else if (projectId && !project) {
      setProjectId(null);
    }
  }, [project, projectId, workspace, workspaceId]);

  const title = project ? "CAD Objects" : workspace ? "Projects" : "Workspaces";
  const subtitle = project
    ? `Choose an object in ${project.name} to open its 3D editor.`
    : workspace
      ? `Projects inside ${workspace.name}.`
      : "Organize local CAD work into workspaces, projects, and objects.";

  return (
    <main className="library-browser">
      <header className="library-header">
        <div className="library-breadcrumbs">
          <button type="button" onClick={() => { setWorkspaceId(null); setProjectId(null); }}>Workspaces</button>
          {workspace && <><span>/</span><button type="button" onClick={() => setProjectId(null)}>{workspace.name}</button></>}
          {project && <><span>/</span><strong>{project.name}</strong></>}
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>

      <section className="library-grid" aria-label={title}>
        {!workspace && props.hierarchy.workspaces.map((item) => {
          const projectCount = item.projects.length;
          const objectCount = item.projects.reduce((total, child) => total + child.objects.length, 0);
          return (
            <article
              className="library-card"
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setWorkspaceId(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setWorkspaceId(item.id);
              }}
            >
              <div className="card-topline">
                <span className="card-icon workspace-card-icon"><Boxes size={22} /></span>
                <CardActions renameLabel={`Rename workspace ${item.name}`} deleteLabel={`Delete workspace ${item.name}`} disabled={props.disabled} onRename={() => props.onRenameWorkspace(item.id, item.name)} onDelete={() => props.onDeleteWorkspace(item.id, item.name)} />
              </div>
              <div className="card-copy"><strong>{item.name}</strong><span>{projectCount} projects · {objectCount} objects</span></div>
              <div className="card-open">Open workspace <ArrowRight size={14} /></div>
            </article>
          );
        })}
        {!workspace && <CreateCard label="New workspace" disabled={props.disabled} onClick={props.onCreateWorkspace} />}

        {workspace && !project && workspace.projects.map((item) => (
          <article
            className="library-card"
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => setProjectId(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setProjectId(item.id);
            }}
          >
            <div className="card-topline">
              <span className="card-icon project-card-icon"><FolderOpen size={22} /></span>
              <CardActions renameLabel={`Rename project ${item.name}`} deleteLabel={`Delete project ${item.name}`} disabled={props.disabled} onRename={() => props.onRenameProject(workspace.id, item.id, item.name)} onDelete={() => props.onDeleteProject(workspace.id, item.id, item.name)} />
            </div>
            <div className="card-copy"><strong>{item.name}</strong><span>{item.objects.length} CAD objects</span></div>
            <div className="card-open">Open project <ArrowRight size={14} /></div>
          </article>
        ))}
        {workspace && !project && <CreateCard label="New project" disabled={props.disabled} onClick={() => props.onCreateProject(workspace.id)} />}

        {workspace && project && project.objects.map((item) => {
          const ref = { workspaceId: workspace.id, projectId: project.id, objectId: item.id };
          return (
            <article
              className="library-card object-card"
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => props.onSelectObject(ref)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") props.onSelectObject(ref);
              }}
            >
              <div className="object-card-preview"><Box size={34} /></div>
              <div className="card-topline object-card-topline">
                <div className="card-copy"><strong>{item.name}</strong><span>Revision {item.revision}</span></div>
                <CardActions renameLabel={`Rename object ${item.name}`} deleteLabel={`Delete object ${item.name}`} disabled={props.disabled} onRename={() => props.onRenameObject(ref, item.name)} onDelete={() => props.onDeleteObject(ref, item.name)} />
              </div>
              <div className="card-open">Open 3D editor <ArrowRight size={14} /></div>
            </article>
          );
        })}
        {workspace && project && <CreateCard label="New CAD object" disabled={props.disabled} onClick={() => props.onCreateObject(workspace.id, project.id)} />}
      </section>
    </main>
  );
}

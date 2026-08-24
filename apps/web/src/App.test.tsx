import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { api } from "./api";
import App from "./App";

vi.mock("./components/CadViewport", () => ({
  CadViewport: () => <div data-testid="cad-viewport" />,
}));

vi.mock("./api", () => ({
  api: {
    hierarchy: vi.fn().mockResolvedValue({
      workspaces: [
        {
          id: "workspace-1",
          name: "Design Workspace",
          projects: [
            {
              id: "project-1",
              name: "Robot Project",
              objects: [{ id: "object-1", name: "Test plate", revision: 0 }],
            },
          ],
        },
      ],
      selected_workspace_id: "workspace-1",
      selected_project_id: "project-1",
      selected_object_id: "object-1",
    }),
    document: vi.fn().mockResolvedValue({
      document: {
        schema_version: 1,
        id: "test",
        name: "Test plate",
        units: "mm",
        revision: 0,
        features: [
          {
            id: "base",
            name: "Base plate",
            enabled: true,
            type: "box",
            width: 50,
            depth: 30,
            height: 5,
            x: 0,
            y: 0,
            z: 0,
            operation: "new",
          },
        ],
      },
      preview_revision: 0,
      summary: null,
    }),
    providerStatus: vi.fn().mockResolvedValue({ provider: "openai", configured: false, storage: "keychain" }),
    createWorkspace: vi.fn().mockResolvedValue({
      workspaces: [{ id: "workspace-2", name: "Factory", projects: [] }],
      selected_workspace_id: "workspace-2",
      selected_project_id: null,
      selected_object_id: null,
    }),
    renameProject: vi.fn().mockResolvedValue({
      workspaces: [
        {
          id: "workspace-1",
          name: "Design Workspace",
          projects: [{ id: "project-1", name: "Motion Platform", objects: [] }],
        },
      ],
      selected_workspace_id: "workspace-1",
      selected_project_id: "project-1",
      selected_object_id: null,
    }),
    previewUrl: vi.fn().mockReturnValue("/preview.stl"),
    exportUrl: vi.fn().mockReturnValue("/export.step"),
  },
}));

test("renders the CAD workspace", async () => {
  render(<App />);
  fireEvent.click(await screen.findByText("Design Workspace"));
  fireEvent.click(await screen.findByText("Robot Project"));
  fireEvent.click(await screen.findByText("Test plate"));

  expect((await screen.findAllByText("Base plate")).length).toBeGreaterThan(0);
  expect(screen.getByLabelText("CAD prompt")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Toggle file tree"));
  expect(document.querySelector(".workspace")).toHaveClass("sidebar-collapsed");
  expect(screen.getByLabelText("Resize prompt panel")).toBeInTheDocument();
});

test("creates a workspace from the hierarchy explorer", async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "New workspace" }));
  const input = screen.getByLabelText("Workspace name");
  fireEvent.change(input, { target: { value: "Factory" } });
  fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

  await waitFor(() => expect(api.createWorkspace).toHaveBeenCalledWith("Factory"));
  expect(await screen.findByText("Factory")).toBeInTheDocument();
});

test("renames a project in the styled dialog", async () => {
  render(<App />);
  fireEvent.click(await screen.findByText("Design Workspace"));
  fireEvent.click(screen.getByLabelText("Rename project Robot Project"));

  const input = screen.getByLabelText("Project name");
  expect(input).toHaveValue("Robot Project");
  fireEvent.change(input, { target: { value: "Motion Platform" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));

  await waitFor(() => {
    expect(api.renameProject).toHaveBeenCalledWith("workspace-1", "project-1", "Motion Platform");
  });
  expect(await screen.findByText("Motion Platform")).toBeInTheDocument();
});

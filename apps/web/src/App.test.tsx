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
    previewUrl: vi.fn().mockReturnValue("/preview.stl"),
    exportUrl: vi.fn().mockReturnValue("/export.step"),
  },
}));

test("renders the CAD workspace", async () => {
  render(<App />);
  expect((await screen.findAllByText("Design Workspace")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Robot Project").length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Test plate")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Base plate").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("CAD prompt")).toBeInTheDocument();
});

test("creates a workspace from the hierarchy explorer", async () => {
  vi.spyOn(window, "prompt").mockReturnValue("Factory");
  render(<App />);

  fireEvent.click(await screen.findByLabelText("Create workspace"));

  await waitFor(() => expect(api.createWorkspace).toHaveBeenCalledWith("Factory"));
  expect(await screen.findByText("Factory")).toBeInTheDocument();
});

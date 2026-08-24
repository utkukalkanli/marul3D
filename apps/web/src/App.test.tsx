import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./components/CadViewport", () => ({
  CadViewport: () => <div data-testid="cad-viewport" />,
}));

vi.mock("./api", () => ({
  api: {
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
  },
}));

test("renders the CAD workspace", async () => {
  render(<App />);
  expect((await screen.findAllByText("Test plate")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Base plate").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("CAD prompt")).toBeInTheDocument();
});

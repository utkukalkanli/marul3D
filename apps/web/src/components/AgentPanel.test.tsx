import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AgentPanel } from "./AgentPanel";
import type { AgentConversation, AgentProposal } from "../types";

const document = {
  schema_version: 1 as const,
  id: "part",
  name: "Bracket",
  units: "mm" as const,
  revision: 3,
  features: [],
};

const proposal: AgentProposal = {
  id: "proposal-1",
  summary: "Add mounting holes",
  document,
  diff: { added: ["Mounting holes"], modified: ["Base"], removed: [] },
  status: "ready",
  error: null,
  build_attempts: 1,
};

const conversation: AgentConversation = {
  schema_version: 1,
  runtime: "opencode",
  opencode_session_id: "session-1",
  messages: [{
    id: "message-1",
    role: "assistant",
    text: "Which size should I use?",
    kind: "clarification",
    options: ["Small", "Large"],
    created_at: "2026-08-25T00:00:00Z",
  }],
  tool_events: [{
    id: "tool-1",
    tool: "build_preview",
    label: "Validating",
    status: "completed",
    detail: "B-rep preview is valid",
  }],
  proposal,
};

test("shows clarification, tool status, feature diff, and approval controls", () => {
  const onSend = vi.fn();
  const onApply = vi.fn();
  const onDiscard = vi.fn();
  render(
    <AgentPanel
      conversation={conversation}
      proposal={proposal}
      streamingText=""
      busy={false}
      objectName="Bracket"
      onSend={onSend}
      onApply={onApply}
      onDiscard={onDiscard}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Small" }));
  expect(onSend).toHaveBeenCalledWith("Small");
  expect(screen.getByText("Validating")).toBeInTheDocument();
  expect(screen.getByText("Mounting holes")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(onApply).toHaveBeenCalledOnce();
  expect(onDiscard).toHaveBeenCalledOnce();
});

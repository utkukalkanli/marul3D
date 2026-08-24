import {
  Check,
  CircleDashed,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AgentConversation, AgentProposal } from "../types";

type AgentPanelProps = {
  conversation: AgentConversation | null;
  proposal: AgentProposal | null;
  streamingText: string;
  busy: boolean;
  objectName: string;
  selectedFeatureName?: string;
  onSend: (prompt: string) => void;
  onApply: () => void;
  onDiscard: () => void;
};

function DiffGroup({ symbol, title, items }: { symbol: string; title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={`agent-diff-group diff-${title.toLowerCase()}`}>
      <strong>{symbol} {title}</strong>
      {items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

export function AgentPanel({
  conversation,
  proposal,
  streamingText,
  busy,
  objectName,
  selectedFeatureName,
  onSend,
  onApply,
  onDiscard,
}: AgentPanelProps) {
  const [prompt, setPrompt] = useState("");
  const messages = useMemo(() => conversation?.messages ?? [], [conversation?.messages]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingText, conversation?.tool_events]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || busy) return;
    setPrompt("");
    onSend(value);
  }

  return (
    <section className="agent-panel" aria-label="Marul Agent">
      <div className="agent-scroll" ref={scrollRef}>
        {!messages.length && (
          <div className="agent-welcome">
            <span><Sparkles size={18} /></span>
            <h2>Design with Marul Agent</h2>
            <p>Describe a parametric part or ask for an edit. I’ll clarify uncertain details and show a feature diff before anything changes.</p>
          </div>
        )}
        {messages.map((message) => (
          <article className={`agent-message ${message.role} ${message.kind}`} key={message.id}>
            <span className="agent-avatar">{message.role === "assistant" ? "M" : "You"}</span>
            <div>
              <small>{message.role === "assistant" ? "Marul Agent" : "You"}</small>
              <p>{message.text}</p>
              {message.kind === "clarification" && message.options.length > 0 && (
                <div className="clarification-options">
                  {message.options.map((option) => (
                    <button type="button" key={option} disabled={busy} onClick={() => onSend(option)}>{option}</button>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
        {streamingText && (
          <article className="agent-message assistant streaming">
            <span className="agent-avatar">M</span>
            <div><small>Marul Agent</small><p>{streamingText}<i /></p></div>
          </article>
        )}
        {!!conversation?.tool_events.length && (
          <section className="tool-timeline" aria-label="Agent tool status">
            {conversation.tool_events.map((event) => (
              <div className={`tool-step ${event.status}`} key={event.id}>
                <span>
                  {event.status === "running" ? <LoaderCircle className="spin" size={13} />
                    : event.status === "failed" ? <X size={13} />
                    : event.status === "awaiting_approval" ? <CircleDashed size={13} />
                    : <Check size={13} />}
                </span>
                <div><strong>{event.label}</strong><small>{event.detail ?? event.tool}</small></div>
              </div>
            ))}
          </section>
        )}
        {proposal && !["discarded", "applied"].includes(proposal.status) && (
          <section className={`proposal-card ${proposal.status}`} aria-label="Proposed changes">
            <header><div><small>PROPOSED CHANGES</small><strong>{proposal.summary}</strong></div><span>{proposal.status}</span></header>
            <div className="agent-diff">
              <DiffGroup symbol="+" title="Added" items={proposal.diff.added} />
              <DiffGroup symbol="~" title="Modified" items={proposal.diff.modified} />
              <DiffGroup symbol="−" title="Removed" items={proposal.diff.removed} />
              {!proposal.diff.added.length && !proposal.diff.modified.length && !proposal.diff.removed.length && <p>No feature-level changes.</p>}
            </div>
            {proposal.error && <p className="proposal-error">{proposal.error}</p>}
            <footer>
              <span>{proposal.build_attempts} validation {proposal.build_attempts === 1 ? "pass" : "passes"}</span>
              <button type="button" className="secondary-button" onClick={onDiscard} disabled={busy}><RotateCcw size={13} /> Discard</button>
              <button type="button" className="primary-button" onClick={onApply} disabled={busy || proposal.status !== "ready"}><Check size={13} /> Apply</button>
            </footer>
          </section>
        )}
      </div>
      <form className="agent-composer" onSubmit={submit}>
        <textarea
          aria-label="CAD prompt"
          placeholder="Describe a new part or edit this CAD object…"
          value={prompt}
          disabled={busy}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div>
          <span>Context: {selectedFeatureName ?? objectName} · OpenCode runtime</span>
          <button className="run-button" type="submit" disabled={!prompt.trim() || busy}>
            {busy ? <LoaderCircle className="spin" size={15} /> : <Play size={14} fill="currentColor" />}
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

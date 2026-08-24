# Marul Agent architecture

Marul Agent separates reasoning from effects. OpenCode owns the conversational session and tool
selection. A local Python `ToolRegistry` owns every capability that can read or change CAD state.
OpenCode has no shell, web, generic read/write, or general filesystem tool.

The current allowlist is:

1. `read_document`
2. `ask_clarification`
3. `propose_features`
4. `build_preview`
5. `apply_document`

`apply_document` is intentionally a misleadingly strong name at the runtime boundary: it only marks
a validated proposal as awaiting approval. The browser's Apply endpoint is the sole path that calls
`ProjectStore.apply`. Conversations, tool events, proposals, checkpoints, and CAD assets remain in
the selected object's local directory. The OpenAI key remains in macOS Keychain and is copied only
into the isolated OpenCode child process environment while it runs.

## Extension path

Future capabilities should be narrow registry tools, not broader runtime permissions:

- Modeling: `cadquery_build`, `trellis_generate_mesh`, `mesh_to_reference`
- Document understanding: `ingest_reference`, `search_documents`, `read_reference_excerpt`
- Knowledge graph: `upsert_design_facts`, `query_design_graph`
- Validation: manufacturing rules, collision checks, and dimension consistency

Images, PDFs, and external CAD files should be ingested locally. Retrieval should send only the
minimum selected excerpts or derived facts to the hosted model. A local vector index can cover MVP
retrieval; Neo4j becomes useful when parent/child features, requirements, components, documents,
materials, and decisions need explicit traversable relationships. LangChain can orchestrate those
retrievers later, but it should sit behind this registry rather than becoming the permission boundary.

Trellis output is mesh-oriented, so it should enter as a preview/reference branch and not silently
replace the editable parametric feature history. A conversion or reconstruction step must be explicit
before it becomes an editable B-rep.

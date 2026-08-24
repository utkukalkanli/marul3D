# marul3D

marul3D is a local-first, AI-assisted parametric CAD workspace. It combines a
VS Code-style browser interface, a Three.js viewport, a local CadQuery engine,
and provider-neutral hosted model adapters.

## MVP capabilities

- Browse local CAD data as workspace, project, and object cards.
- See each object's latest geometry in a slowly rotating live 3D card preview.
- Create, rename, select, and recoverably delete every hierarchy level.
- Keep a compact, optional hierarchy tree beside the 3D editor.
- Resize the AI prompt panel vertically to balance chat and viewport space.
- Edit numeric parameters with debounced sliders and switch between millimetres,
  centimetres, and inches without changing geometry.
- Collapse the Properties Inspector when the viewport needs more space.
- Keep independent geometry, previews, imports, exports, and edit history per object.
- Create parametric parts from natural-language prompts.
- Edit an ordered feature history and rebuild only its dirty suffix with a persistent,
  content-addressed B-rep cache.
- Fall back to restricted custom CadQuery features for open-ended geometry.
- Import STEP as an editable base solid and STL as a reference mesh.
- Export rebuilt geometry to STEP or STL.
- Keep CAD files local while calling hosted models with a user-owned API key.
- Store provider credentials in macOS Keychain.
- Use the conversational Marul Agent with clarification, streamed tool status,
  validated feature proposals, and explicit Apply/Discard controls.
- Browse a constrained extension marketplace and connect the TRELLIS.2 extension
  to a user-configured remote GPU worker without shell or broad filesystem access.
- Explore Community CAD listings with category and price filters, and create
  private local seller drafts from the selected CAD object.
- Browse ready/processing scan records and copy a ready scan into a chosen project
  as an STL reference object.

## Prerequisites

- macOS on Apple Silicon
- Node.js 22 or newer
- `uv`
- Python 3.12 (installed automatically by `uv` when needed)

## Setup

```bash
npm run setup
npm run dev
```

Open <http://localhost:5173>. The local API listens on
<http://127.0.0.1:8000> and is proxied by Vite during development.

## Project structure

```text
apps/web  React, TypeScript, and Three.js workspace
apps/api  FastAPI, CadQuery, provider adapters, persistence, and Keychain
docs      Architecture and product notes
```

The application migrates the original single CAD document into `My Workspace / First
Project` on first launch. Deleted hierarchy entries are retained under the local app
data directory's `.trash` folder so they can be recovered manually.

## Privacy model

CAD source files and generated geometry stay on the Mac. The model provider
receives the prompt and a compact JSON representation of the feature history.
OpenAI requests use `store: false`. API keys are never returned to the browser.

Community checkout, seller onboarding, publishing, mobile capture, and cross-device
account sync are explicit hosted-service boundaries and are not simulated by the
local MVP. See `docs/community-marketplace.md`, `docs/extension-system.md`, and
`docs/scans-architecture.md` for the intended trust boundaries.

Entire is enabled for Codex and syncs session checkpoints to the Git remote.
Start future Codex sessions from this repository directory so its hooks can
capture them automatically.

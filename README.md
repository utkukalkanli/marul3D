# marul3D

marul3D is a local-first, AI-assisted parametric CAD workspace. It combines a
VS Code-style browser interface, a Three.js viewport, a local CadQuery engine,
and provider-neutral hosted model adapters.

## MVP capabilities

- Create parametric parts from natural-language prompts.
- Edit an ordered feature history and rebuild geometry transactionally.
- Fall back to restricted custom CadQuery features for open-ended geometry.
- Import STEP as an editable base solid and STL as a reference mesh.
- Export rebuilt geometry to STEP or STL.
- Keep CAD files local while calling hosted models with a user-owned API key.
- Store provider credentials in macOS Keychain.

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

## Privacy model

CAD source files and generated geometry stay on the Mac. The model provider
receives the prompt and a compact JSON representation of the feature history.
OpenAI requests use `store: false`. API keys are never returned to the browser.

Entire is enabled for Codex and syncs session checkpoints to the Git remote.
Start future Codex sessions from this repository directory so its hooks can
capture them automatically.

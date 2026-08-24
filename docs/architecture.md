# Architecture

## Boundary

The browser communicates only with the loopback FastAPI service. The local
service owns provider credentials, project files, geometry builds, imports,
and exports. Provider adapters receive a compact document description rather
than raw CAD files.

## Parametric document

`CadDocument` is the source of truth. Its ordered features use stable string
identifiers, declared parameters, and explicit operations. A prompt produces a
complete candidate document. The service validates and rebuilds the candidate
before replacing the current revision, so a failed generation never corrupts
the last valid model.

Standard features are individually editable. `custom_cadquery` is the escape
hatch for open-ended generation and exposes declared parameters plus source.
Custom source is validated and executed in a short-lived subprocess, never in
the API process.

## Preview

CadQuery/OpenCascade owns the B-rep. The backend tessellates the current shape
to binary STL for the Three.js viewport. STEP remains the interchange and
editable-base format; STL imports are reference meshes because they do not
contain a recoverable parametric history.

## Provider layer

The domain service depends on a `ModelProvider` protocol. The OpenAI adapter
uses the Responses API and Pydantic Structured Outputs. Requests set
`store=False`; the credential comes from macOS Keychain through the backend.

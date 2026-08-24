# marul3D extension system

The marketplace is a catalog and permission boundary, not a way to execute arbitrary downloaded
code. Extensions declare their activation events, commands, asset types, agent tools, authentication,
and requested permissions in `extension.json`. The local extension host decides which declared
contributions are available.

For the MVP, first-party manifests are shipped with marul3D and install state is stored locally in
`extensions.json`. Secrets never enter the manifest or browser storage. Each extension receives a
namespaced macOS Keychain entry.

## TRELLIS.2 remote-worker contract

The official TRELLIS.2 release requires Linux, CUDA, and a large NVIDIA GPU. The macOS client therefore
connects to a user-selected compatible worker over HTTPS (loopback HTTP is also accepted for local
development).

Connection verification:

```http
POST /v1/auth/verify
Authorization: Bearer <token>
Content-Type: application/json

{"client":"marul3D"}
```

Any 2xx response authenticates the worker. Only then does marul3D store the token in Keychain and mark
the extension connected. The next worker contract will add image upload, job status, cancellation, and
GLB download. Generated meshes must enter an object as local reference assets and cannot silently
replace parametric B-rep history.

## Public marketplace path

Before accepting third-party packages, the registry needs signed manifests, publisher verification,
immutable version artifacts, engine compatibility checks, permission review, update/rollback support,
and a sandboxed contribution protocol. Third-party extensions must never gain shell or unrestricted
filesystem access merely by being installed.

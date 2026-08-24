# Scans architecture

The desktop MVP exposes a Scans library before mobile capture exists. Ready demo scans
can be copied into a chosen workspace and project as STL reference-mesh objects. This
exercises the destination workflow without presenting the demo catalog as real user data.

## Current local flow

1. Browse ready and processing scan records.
2. Inspect capture frame count, mesh size, dimensions, quality, and source device.
3. Choose **Copy to project** on a ready scan.
4. Select a workspace and project and name the new object.
5. marul3D creates a separate STL reference object and opens it in the editor.

The source scan remains unchanged. Parametric reverse engineering is intentionally a
separate future agent tool; copying a triangle mesh does not make it a B-rep feature tree.

## Mobile and account-sync boundary

The mobile capture app is out of scope for this MVP. A hosted service will be required for:

- OIDC/OAuth account identity shared by desktop and mobile
- capture-session creation and resumable image/video-frame upload
- camera guidance and coverage/blur telemetry
- queued photogrammetry or neural reconstruction jobs
- mesh validation, decimation, texturing, and preview generation
- per-user object storage and signed downloads
- push/WebSocket processing-state updates
- offline reconciliation and deletion propagation

Recommended resource hierarchy:

`Account → Capture Session → Source Frames → Reconstruction Job → Scan Asset → Project Copy`

Project copies should reference an immutable scan version. Reprocessing a scan can create
a new version but must not silently replace geometry already used by a CAD project.

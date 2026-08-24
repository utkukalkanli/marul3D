# TRELLIS.2 extension

The first-party marul3D extension for connecting an image-to-3D TRELLIS.2 GPU worker.

The official model currently requires Linux, CUDA, and an NVIDIA GPU with at least 24 GB memory, so
the macOS-first marul3D client treats TRELLIS as a remote worker. The user supplies an HTTPS endpoint
and API token; the token is stored in macOS Keychain. Generated GLB files are intended to remain local
object assets and enter CAD as mesh references, not editable B-rep feature history.

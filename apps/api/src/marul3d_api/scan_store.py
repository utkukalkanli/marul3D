from __future__ import annotations

from marul3d_api.models import ScanAsset, ScanCatalogResponse


class ScanError(RuntimeError):
    pass


SCANS = [
    ScanAsset(
        id="scan-ceramic-vase",
        name="Ceramic studio vase",
        status="ready",
        captured_at="2026-08-23T16:42:00+00:00",
        source_device="iPhone demo capture",
        image_count=184,
        progress=100,
        quality="high",
        triangle_count=128_420,
        dimensions_mm=[142, 139, 286],
        size_mb=18.4,
    ),
    ScanAsset(
        id="scan-control-knob",
        name="Vintage control knob",
        status="ready",
        captured_at="2026-08-21T11:08:00+00:00",
        source_device="iPhone demo capture",
        image_count=96,
        progress=100,
        quality="standard",
        triangle_count=64_832,
        dimensions_mm=[48, 48, 31],
        size_mb=8.1,
    ),
    ScanAsset(
        id="scan-rock-study",
        name="Garden rock study",
        status="processing",
        captured_at="2026-08-25T08:14:00+00:00",
        source_device="Mobile upload simulation",
        image_count=231,
        progress=68,
        quality="high",
        triangle_count=0,
        dimensions_mm=[0, 0, 0],
        size_mb=0,
    ),
    ScanAsset(
        id="scan-bracket",
        name="Cast bracket reference",
        status="ready",
        captured_at="2026-08-18T09:31:00+00:00",
        source_device="Camera demo capture",
        image_count=143,
        progress=100,
        quality="standard",
        triangle_count=89_104,
        dimensions_mm=[118, 74, 93],
        size_mb=11.6,
    ),
]


class ScanStore:
    """Demo scan catalog; mobile uploads and cloud sync belong to the hosted service."""

    def catalog(self) -> ScanCatalogResponse:
        return ScanCatalogResponse(scans=SCANS, account_mode="local")

    def asset(self, scan_id: str) -> ScanAsset:
        scan = next((item for item in SCANS if item.id == scan_id), None)
        if scan is None:
            raise ScanError("Scan not found")
        return scan

    def stl_bytes(self, scan_id: str) -> bytes:
        scan = self.asset(scan_id)
        if scan.status != "ready":
            raise ScanError("Only completed scans can be copied to a project")
        scale = {
            "scan-ceramic-vase": (70.0, 70.0, 140.0),
            "scan-control-knob": (25.0, 25.0, 16.0),
            "scan-bracket": (58.0, 36.0, 46.0),
        }.get(scan_id, (40.0, 40.0, 40.0))
        return _octahedron_stl(scan.name, *scale).encode("ascii")


def _octahedron_stl(name: str, x: float, y: float, z: float) -> str:
    top = (0.0, 0.0, z)
    bottom = (0.0, 0.0, -z)
    ring = [(x, 0.0, 0.0), (0.0, y, 0.0), (-x, 0.0, 0.0), (0.0, -y, 0.0)]
    faces = []
    for index in range(4):
        current = ring[index]
        following = ring[(index + 1) % 4]
        faces.append((top, current, following))
        faces.append((bottom, following, current))
    lines = [f"solid {name.replace(' ', '_')}"]
    for face in faces:
        lines.extend([" facet normal 0 0 0", "  outer loop"])
        lines.extend(f"   vertex {vx} {vy} {vz}" for vx, vy, vz in face)
        lines.extend(["  endloop", " endfacet"])
    lines.append(f"endsolid {name.replace(' ', '_')}")
    return "\n".join(lines)

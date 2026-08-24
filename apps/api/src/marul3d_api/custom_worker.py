from __future__ import annotations

import json
import resource
import sys
from pathlib import Path

import cadquery as cq

from marul3d_api.build_engine import validate_custom_source


def _limit_process() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
    resource.setrlimit(resource.RLIMIT_FSIZE, (100 * 1024 * 1024, 100 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))


def main() -> int:
    _limit_process()
    payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    source = payload["source"]
    validate_custom_source(source)
    base = cq.importers.importStep(payload["base_step"]) if payload["base_step"] else None
    safe_builtins = {
        "abs": abs,
        "bool": bool,
        "dict": dict,
        "enumerate": enumerate,
        "float": float,
        "int": int,
        "len": len,
        "list": list,
        "max": max,
        "min": min,
        "range": range,
        "round": round,
        "str": str,
        "sum": sum,
        "tuple": tuple,
        "zip": zip,
    }
    namespace = {
        "__builtins__": safe_builtins,
        "cq": cq,
        "base": base,
        "params": payload["parameters"],
    }
    exec(compile(source, "<marul3d-custom>", "exec"), namespace, namespace)
    result = namespace.get("result")
    if not isinstance(result, (cq.Workplane, cq.Shape)):
        raise TypeError("result must be a CadQuery Workplane or Shape")
    cq.exporters.export(result, payload["output_step"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

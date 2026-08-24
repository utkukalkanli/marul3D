from __future__ import annotations

import json
from pathlib import Path

from openai import OpenAI

from marul3d_api.models import CadDocument, CadProposal

SYSTEM_PROMPT = """You are the parametric CAD planner inside marul3D.
Return a complete candidate CadDocument that satisfies the user's request.

Rules:
- Preserve existing feature IDs for unchanged features.
- Use millimetres.
- Prefer standard features: box, cylinder, hole_pattern, and fillet.
- Features execute in list order and must produce a valid solid.
- A box or cylinder with operation=new must establish the initial solid.
- Use custom_cadquery only when standard features cannot express the geometry.
- custom_cadquery source receives `cq`, optional `base`, and a `params` mapping.
  It must assign a CadQuery Workplane or Shape to `result`. Never import modules,
  access files, use the network, or call private/dunder attributes.
- For imported features, preserve source_path exactly.
- Explain the change briefly in summary, but put all geometry in document.
"""


def _provider_document(document: CadDocument) -> str:
    payload = document.model_dump(mode="json")
    for feature in payload["features"]:
        if feature["type"] in {"import_step", "import_stl"}:
            feature["source_path"] = Path(feature["source_path"]).name
    return json.dumps(payload, separators=(",", ":"))


class OpenAIProvider:
    def __init__(self, api_key: str) -> None:
        self.client = OpenAI(api_key=api_key)

    def propose(self, prompt: str, document: CadDocument, model: str) -> CadProposal:
        response = self.client.responses.parse(
            model=model,
            store=False,
            input=[
                {"role": "developer", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Current document:\n{_provider_document(document)}\n\n"
                        f"Requested change:\n{prompt}"
                    ),
                },
            ],
            text_format=CadProposal,
        )
        if response.status != "completed":
            reason = getattr(response.incomplete_details, "reason", "unknown")
            raise RuntimeError(f"Model response was incomplete: {reason}")
        if response.output_parsed is None:
            raise RuntimeError("The model did not return a CAD proposal")
        proposal = response.output_parsed
        local_paths = {
            feature.id: feature.source_path
            for feature in document.features
            if feature.type in {"import_step", "import_stl"}
        }
        for feature in proposal.document.features:
            if feature.type in {"import_step", "import_stl"} and feature.id in local_paths:
                feature.source_path = local_paths[feature.id]
        return proposal

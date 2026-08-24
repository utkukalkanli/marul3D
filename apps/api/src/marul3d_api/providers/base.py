from __future__ import annotations

from typing import Protocol

from marul3d_api.models import CadDocument, CadProposal


class ModelProvider(Protocol):
    def propose(self, prompt: str, document: CadDocument, model: str) -> CadProposal: ...

from __future__ import annotations

from typing import Any, Protocol


class ToolContract(Protocol):
    name: str
    purpose: str
    inputs: dict[str, str]
    outputs: dict[str, str]
    def execute(self, **kwargs: Any) -> Any: ...


def validate_tool_contract(contract: dict[str, Any]) -> None:
    required = {"name", "purpose", "inputs", "outputs"}
    missing = required - set(contract)
    if missing:
        raise ValueError(f"chaves ausentes: {sorted(missing)}")
    if not isinstance(contract["inputs"], dict):
        raise TypeError("'inputs' precisa ser dict")
    if not isinstance(contract["outputs"], dict):
        raise TypeError("'outputs' precisa ser dict")

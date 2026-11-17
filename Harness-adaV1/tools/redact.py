from __future__ import annotations

import re

TOOL_CONTRACT = {
    "name": "redact",
    "purpose": "Mascara valores sensíveis no texto antes de expor a saída a agentes ou logs.",
    "inputs": {"text": "string"},
    "outputs": {"result": "string"},
}

SECRET_PATTERNS = [
    re.compile(r"(?i)(BRAVE_SEARCH_API_KEY=)[A-Za-z0-9_\-]+"),
    re.compile(r"(?i)(sk-[A-Za-z0-9]{10,})"),
    re.compile(r"(?i)(ghp_[A-Za-z0-9]{10,})"),
    re.compile(r"(?i)(aws_access_key_id=)[A-Za-z0-9]+"),
    re.compile(r"(?i)(password\s*[:=]\s*)([^\s\n]+)"),
]


def redact(text: str) -> str:
    redacted = text
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub(lambda match: match.group(1) + "[REDACTED]" if match.lastindex and match.lastindex >= 1 else "[REDACTED]", redacted)
    return redacted

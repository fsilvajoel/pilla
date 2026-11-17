from __future__ import annotations

from urllib import request

TOOL_CONTRACT = {
    "name": "fetch_page",
    "purpose": "Busca o texto de uma página HTTPS para revisão ou extração.",
    "inputs": {"url": "string"},
    "outputs": {"result": "string"},
}


def fetch_page(url: str) -> str:
    if not url.startswith("https://"):
        raise ValueError("Só URLs HTTPS são permitidas")
    req = request.Request(url, headers={"User-Agent": "Harness-adaV1/1.0"})
    with request.urlopen(req, timeout=20) as response:
        content = response.read(400_000).decode("utf-8", errors="replace")
    return content

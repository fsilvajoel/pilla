from __future__ import annotations

import json
import os
from urllib import request, parse

TOOL_CONTRACT = {
    "name": "web_health",
    "purpose": "Confere se a chave da API de busca é válida e traz resultados para uma consulta.",
    "inputs": {"query": "string", "api_key": "string | None"},
    "outputs": {"result": "dict"},
}


def web_health(query: str = "NestJS modules site:docs.nestjs.com", api_key: str | None = None) -> dict:
    key = api_key or os.environ.get("BRAVE_SEARCH_API_KEY")
    if not key:
        return {"ok": False, "error": "BRAVE_SEARCH_API_KEY is missing"}

    params = parse.urlencode({"q": query, "count": "3"})
    req = request.Request(
        f"https://api.search.brave.com/res/v1/web/search?{params}",
        headers={
            "Accept": "application/json",
            "X-Subscription-Token": key,
        },
    )

    try:
        with request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            results = payload.get("web", {}).get("results", [])
            return {
                "ok": resp.status == 200,
                "http_code": resp.status,
                "result_count": len(results),
                "results": [{"title": item.get("title"), "url": item.get("url")} for item in results[:3]],
            }
    except Exception as exc:  # pragma: no cover - falha de rede depende do ambiente
        return {"ok": False, "error": str(exc)}

import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.web_health import web_health


class FakeResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return b'{"web":{"results":[{"title":"Example","url":"https://example.com"}]}}'


def test_web_health_returns_ok_for_valid_key():
    with patch("tools.web_health.request.urlopen", return_value=FakeResponse()):
        result = web_health("example search", "valid-key")
    assert result["ok"] is True
    assert result["result_count"] == 1
    assert result["results"][0]["url"] == "https://example.com"


def test_web_health_handles_missing_key():
    result = web_health("example search", None)
    assert result["ok"] is False
    assert "missing" in result["error"].lower()

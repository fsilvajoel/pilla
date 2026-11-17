import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.redact import redact


def test_redact_masks_known_secret_values():
    value = "BRAVE_SEARCH_API_KEY=FAKE_example_key_0000000000"
    redacted = redact(value)
    assert "FAKE_example_key_0000000000" not in redacted
    assert "[REDACTED]" in redacted

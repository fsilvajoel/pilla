"""LI-049: a 5xx from Ollama (gpt-oss tool-call parse error) is retried instead of crashing the run."""
import io
import unittest
import urllib.error
from unittest import mock

import alice


def http_error(code: int, body: bytes = b'{"error":"error parsing tool call"}') -> urllib.error.HTTPError:
    return urllib.error.HTTPError("http://x/api/chat", code, "err", {}, io.BytesIO(body))


def ok(text: str = '{"message": {"role": "assistant", "content": "oi"}}'):
    resp = mock.MagicMock()
    resp.__enter__.return_value = io.StringIO(text)
    return resp


class PostChatTest(unittest.TestCase):
    def test_retries_a_server_error_and_reports_its_body(self):
        seen = []
        with mock.patch("urllib.request.urlopen", side_effect=[http_error(500), ok()]):
            data = alice.post_chat({}, 5, lambda n, c, b: seen.append((n, c, b)), wait=0)
        self.assertEqual(data["message"]["content"], "oi")
        self.assertEqual(seen, [(1, 500, '{"error":"error parsing tool call"}')])

    def test_gives_up_after_the_last_try(self):
        with mock.patch("urllib.request.urlopen", side_effect=[http_error(500) for _ in range(3)]):
            with self.assertRaisesRegex(RuntimeError, "500 após 3 tentativas: .*parsing tool call"):
                alice.post_chat({}, 5, wait=0)

    def test_client_error_is_not_retried(self):
        with mock.patch("urllib.request.urlopen", side_effect=[http_error(404, b"model not found")]) as m:
            with self.assertRaises(urllib.error.HTTPError):
                alice.post_chat({}, 5, wait=0)
        self.assertEqual(m.call_count, 1)


if __name__ == "__main__":
    unittest.main()

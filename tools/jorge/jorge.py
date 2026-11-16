#!/usr/bin/env python3
"""Ponto de entrada do Jorge. O runner é o núcleo fixo em nucleo/runner.py (ver docstring de lá e README.md)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "nucleo"))
import runner  # noqa: E402

if __name__ == "__main__":
    sys.exit(runner.main())

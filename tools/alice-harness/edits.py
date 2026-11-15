def apply_edit(text: str, old: str, new: str, replace_all: bool = False) -> str:
    """
    Replaces an exact string occurrence in the given text.
    
    Args:
        text: The original text.
        old: The string to be replaced.
        new: The string to replace it with.
        replace_all: If True, replaces all occurrences. If False, replaces only the first.
        
    Returns:
        The modified text.
        
    Raises:
        ValueError: If 'old' is empty, not found, or if multiple occurrences exist when replace_all is False.
    """
    if not old:
        raise ValueError("A string vazia não pode ser pesquisada.")

    if old == new:
        raise ValueError("A string 'old' e 'new' não podem ser idênticas.")

    count = text.count(old)
    
    if count == 0:
        raise ValueError("não encontrado")
    
    if count > 1 and not replace_all:
        raise ValueError(f"O texto '{old}' foi encontrado {count} vezes. Use replace_all=True para substituir todos.")

    if replace_all:
        return text.replace(old, new)
    else:
        return text.replace(old, new, 1)


# ---------------------------------------------------------------- tolerant editing for the local model (LI-017)
import difflib
import re

_LINE_NO = re.compile(r"^\s*\d+\t")


def _norm(line: str) -> str:
    return _LINE_NO.sub("", line).strip()


def closest_snippet(text: str, old: str) -> str:
    """The block of `text` most similar to `old` (same number of lines)."""
    lines, want = text.splitlines(), [_norm(l) for l in old.splitlines()] or [""]
    n, best, best_i = len(want), -1.0, 0
    for i in range(max(1, len(lines) - n + 1)):
        ratio = difflib.SequenceMatcher(None, "\n".join(want), "\n".join(_norm(l) for l in lines[i:i + n])).ratio()
        if ratio > best:
            best, best_i = ratio, i
    return "\n".join(lines[best_i:best_i + n])


def apply_edit_tolerant(text: str, old: str, new: str, replace_all: bool = False) -> str:
    """Exact replacement first; otherwise match line by line ignoring 'N<tab>' prefixes (from read_file) and indentation."""
    try:
        return apply_edit(text, old, new, replace_all)
    except ValueError as e:
        if "não encontrado" not in str(e):
            raise
    want = [_norm(l) for l in old.splitlines() if l.strip()]
    lines = text.splitlines(keepends=True)
    hits = [i for i in range(len(lines) - len(want) + 1) if want and [_norm(l) for l in lines[i:i + len(want)]] == want]
    if len(hits) != 1:
        hint = closest_snippet(text, old)
        raise ValueError(("trecho não encontrado" if not hits else f"trecho ocorre {len(hits)} vezes") +
                         ". Trecho mais parecido no arquivo (copie exatamente, sem números de linha):\n" + hint)
    i = hits[0]
    body = "\n".join(_LINE_NO.sub("", l) for l in new.splitlines())
    return "".join(lines[:i]) + body + ("\n" if not body.endswith("\n") else "") + "".join(lines[i + len(want):])


def replace_function(text: str, name: str, code: str) -> str:
    """Replace the whole top-level `function name` (declaration line to the closing '}' at column 0)."""
    lines = text.splitlines(keepends=True)
    head = re.compile(rf"^(export\s+)?(async\s+)?function\s+{re.escape(name)}\b")
    start = next((i for i, l in enumerate(lines) if head.match(l)), None)
    if start is None:
        raise ValueError(f"função {name} não encontrada no arquivo")
    if not re.search(rf"\bfunction\s+{re.escape(name)}\b", code):
        raise ValueError(f"o código novo precisa declarar a função {name}")
    end = next((j for j in range(start, len(lines)) if lines[j].rstrip("\n") == "}"), None)
    if end is None:
        raise ValueError(f"fim da função {name} não encontrado ('}}' na coluna 0)")
    body = "\n".join(_LINE_NO.sub("", l) for l in code.strip("\n").splitlines()) + "\n"
    return "".join(lines[:start]) + body + "".join(lines[end + 1:])

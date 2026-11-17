#!/usr/bin/env python3
"""Leitura tipada do `harness.project.yaml`.

Usa o PyYAML quando ele está instalado. Sem ele, cai num leitor próprio que
entende o subconjunto usado pelo harness:

- `chave: escalar` no topo;
- `chave:` seguida de lista indentada (`- item`);
- `chave:` seguida de mapa indentado de um nível (`sub: valor`), em que o
  valor pode ser escalar, mapa em linha (`{a: b}`), lista em linha (`[a, b]`)
  ou lista indentada logo abaixo.
"""

from __future__ import annotations

from pathlib import Path

type Scalar = str | int | float | bool | None
type ConfigValue = Scalar | list[ConfigValue] | dict[str, ConfigValue]
type Config = dict[str, ConfigValue]

CONFIG_NAME = "harness.project.yaml"


def parse_scalar(value: str) -> Scalar:
    """Converte um texto simples de YAML no escalar Python equivalente."""
    if value in {"null", "Null", "NULL", "~"}:
        return None
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    if len(value) >= 2 and value[0] in {"'", '"'} and value[-1] == value[0]:
        return value[1:-1]
    if value.isdigit():
        return int(value)
    try:
        return float(value)
    except ValueError:
        return value


def _split_inline(body: str) -> list[str]:
    """Divide o miolo de `{...}` ou `[...]` por vírgulas fora de aspas."""
    parts: list[str] = []
    current: list[str] = []
    quote: str | None = None
    for char in body:
        if quote is not None:
            current.append(char)
            if char == quote:
                quote = None
            continue
        if char in {"'", '"'}:
            quote = char
            current.append(char)
        elif char == ",":
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return [part for part in parts if part]


def parse_value(value: str) -> ConfigValue:
    """Lê um valor de linha: mapa em linha, lista em linha ou escalar."""
    text = value.strip()
    if text.startswith("{") and text.endswith("}"):
        mapping: dict[str, ConfigValue] = {}
        for item in _split_inline(text[1:-1]):
            if ":" not in item:
                raise ValueError(f"Item de mapa em linha sem ':': {item}")
            key, raw = item.split(":", 1)
            mapping[key.strip()] = parse_scalar(raw.strip())
        return mapping
    if text.startswith("[") and text.endswith("]"):
        return [parse_scalar(item) for item in _split_inline(text[1:-1])]
    return parse_scalar(text)


def _strip_comment(line: str) -> str:
    """Remove comentário de fim de linha que esteja fora de aspas."""
    quote: str | None = None
    for index, char in enumerate(line):
        if quote is not None:
            if char == quote:
                quote = None
        elif char in {"'", '"'}:
            quote = char
        elif char == "#" and (index == 0 or line[index - 1] in {" ", "\t"}):
            return line[:index].rstrip()
    return line.rstrip()


def parse_simple_yaml(raw: str) -> Config:
    """Leitor de reserva para o subconjunto de YAML descrito no módulo."""
    data: Config = {}
    top_key: str | None = None
    sub_key: str | None = None
    for raw_line in raw.splitlines():
        line = _strip_comment(raw_line)
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        if indent == 0:
            sub_key = None
            if ":" not in stripped:
                raise ValueError(f"Linha de topo sem ':': {stripped}")
            key, value = stripped.split(":", 1)
            key = key.strip()
            if value.strip():
                data[key] = parse_value(value)
                top_key = None
            else:
                data[key] = None
                top_key = key
            continue

        if top_key is None:
            raise ValueError(f"Linha indentada sem chave-mãe: {stripped}")

        current = data.get(top_key)
        if stripped.startswith("- ") or stripped == "-":
            item = parse_value(stripped[1:].strip())
            if sub_key is not None and isinstance(current, dict):
                nested = current.get(sub_key)
                if not isinstance(nested, list):
                    nested = []
                    current[sub_key] = nested
                nested.append(item)
                continue
            if current is None:
                current = []
                data[top_key] = current
            if not isinstance(current, list):
                raise TypeError(f"A chave '{top_key}' não é lista")
            current.append(item)
            continue

        if ":" not in stripped:
            raise ValueError(f"Linha de mapa sem ':': {stripped}")
        key, value = stripped.split(":", 1)
        key = key.strip()
        if current is None:
            current = {}
            data[top_key] = current
        if not isinstance(current, dict):
            raise TypeError(f"A chave '{top_key}' não é mapa")
        if value.strip():
            current[key] = parse_value(value)
            sub_key = None
        else:
            current[key] = None
            sub_key = key
    return data


def parse_config_text(raw: str) -> Config:
    """Lê o texto do yaml, com PyYAML quando disponível."""
    try:
        import yaml
    except ImportError:
        return parse_simple_yaml(raw)
    loaded: object = yaml.safe_load(raw) or {}
    if not isinstance(loaded, dict):
        raise TypeError("A configuração do projeto precisa ser um mapa")
    return {str(key): value for key, value in loaded.items()}


def load_config(project_root: Path, required: bool = False) -> Config:
    """Carrega `harness.project.yaml` da raiz do projeto."""
    path = project_root / CONFIG_NAME
    if not path.exists():
        if required:
            raise FileNotFoundError(f"Configuração do projeto ausente: {path}")
        return {}
    return parse_config_text(path.read_text(encoding="utf-8"))


def get_str_list(config: Config, *keys: str) -> list[str]:
    """Busca uma lista de textos seguindo `keys`; ausente vira lista vazia."""
    node: ConfigValue = config
    for key in keys:
        if not isinstance(node, dict):
            return []
        node = node.get(key)
    if not isinstance(node, list):
        return []
    return [str(item) for item in node if item is not None]


def get_str(config: Config, *keys: str) -> str | None:
    """Busca um texto seguindo `keys`; ausente vira None."""
    node: ConfigValue = config
    for key in keys:
        if not isinstance(node, dict):
            return None
        node = node.get(key)
    return node if isinstance(node, str) else None

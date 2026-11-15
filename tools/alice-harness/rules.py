import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

RULE_ID = re.compile(r"[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+")  # RN-C03, T-01, RNF-01, L-09


def index_rules(root: Path) -> Dict[str, Tuple[str, int]]:
    """
    Indexes rule definitions in markdown files.
    Returns a mapping of rule ID to (relative_path, line_number).
    """
    index = {}
    # Walk through all .md files in docs/ and sort them to ensure deterministic behavior
    files = sorted(list(root.glob("docs/**/*.md")))
    for md_file in files:
        with md_file.open(encoding="utf-8") as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                stripped = line.strip()
                # Check for bullet point definition: - **ID**
                if stripped.startswith("- **") and " **" in stripped:
                    parts = stripped.split(" **")
                    if len(parts) >= 2:
                        id_part = parts[1].split("**")[0].strip()
                        # ID must have at least one hyphen
                        if id_part and RULE_ID.fullmatch(id_part) and id_part not in index:
                            rel_path = str(md_file.relative_to(root))
                            index[id_part] = (rel_path, i + 1)
                            continue

                # Check for table row definition: | ID | ... |
                if stripped.startswith("|") and "|" in stripped:
                    cells = [c.strip() for c in stripped.split("|")]
                    id_part = None
                    # A table row starts with | and has at least 2 cells (ID and content)
                    # If the line is | ID | ... | , cells will be ['', 'ID', ...]
                    if cells[0] and cells[0] not in ["ID", "---", "___"]:
                        id_part = cells[0]
                    elif len(cells) > 1 and cells[1] and cells[1] not in ["ID", "---", "___"]:
                        id_part = cells[1]
                    
                    if id_part and RULE_ID.fullmatch(id_part) and id_part not in index:
                        rel_path = str(md_file.relative_to(root))
                        index[id_part] = (rel_path, i + 1)
    return index

def find_rule(root: Path, rule_id: str) -> Optional[str]:
    """
    Finds the text of a rule definition by its ID.
    Returns a string in the format "path:line\ncontent".
    """
    idx = index_rules(root)
    if rule_id not in idx:
        return None
    
    rel_path, line_num = idx[rule_id]
    full_path = root / rel_path
    
    with full_path.open(encoding="utf-8") as f:
        lines_content = f.readlines()
        target_line_idx = line_num - 1
        
        if target_line_idx >= len(lines_content):
            return None
            
        current_line = lines_content[target_line_idx]
        
        if current_line.strip().startswith("- **"):
            # Bullet block: include indented lines
            block = [current_line]
            for j in range(target_line_idx + 1, len(lines_content)):
                if lines_content[j].startswith("  ") or lines_content[j].startswith("\t"):
                    block.append(lines_content[j])
                else:
                    break
            
            # Cap at 40 lines of content (excluding the header line)
            # Total block size = 1 (header) + 40 (content) = 41.
            # If block has more than 40 lines, we cap it at 40.
            if len(block) > 40:
                block = block[:40]
            
            content = "".join(block)
            return f"{rel_path}:{line_num}\n{content}"
        else:
            content = current_line
            return f"{rel_path}:{line_num}\n{content}"

def rules_text(root: Path, ids: List[str]) -> str:
    """
    Joins the text of multiple rules, flagging missing ones.
    """
    results = []
    for rid in ids:
        res = find_rule(root, rid)
        if res:
            results.append(res)
        else:
            results.append(f"(não encontrada: {rid})")
    return "\n".join(results)


DOC_REF = re.compile(r"^((?:RFC|ADR|PRD)-\d+)(?:\s*§\s*([\d.]+))?$")


def find_doc(root: Path, ref: str) -> Optional[str]:
    """
    'RFC-002' -> outline (headings with line numbers); 'RFC-002 §3.4' -> that section's text (max 60 lines).
    LI-024: E1-T20 asked Claude because read_rule only knew rule IDs, not documents.
    """
    m = DOC_REF.match(ref.strip())
    if not m:
        return None
    doc_id, section = m.group(1), m.group(2)
    num = doc_id.split("-")[1].lstrip("0")
    matches = sorted(p for p in root.glob("docs/**/*.md")
                     if re.match(rf"^{doc_id.split('-')[0]}-0*{num}\b", p.name, re.I) or re.match(rf"^0*{num}-", p.name) and doc_id.startswith("ADR") and "adr" in p.parts)
    if not matches:
        return None
    path = matches[0]
    rel = str(path.relative_to(root))
    lines = path.read_text(encoding="utf-8").splitlines()
    if not section:
        outline = [f"{i + 1}: {l}" for i, l in enumerate(lines) if l.startswith("#")]
        return f"{rel} (sumário; use read_rule('{doc_id} §N') para uma seção ou read_file)\n" + "\n".join(outline[:60])
    start = next((i for i, l in enumerate(lines) if re.match(rf"^#+\s+{re.escape(section)}[.\s]", l)), None)
    if start is None:
        return None
    level = len(lines[start]) - len(lines[start].lstrip("#"))
    end = next((j for j in range(start + 1, len(lines))
                if lines[j].startswith("#") and len(lines[j]) - len(lines[j].lstrip("#")) <= level), len(lines))
    return f"{rel}:{start + 1}\n" + "\n".join(lines[start:min(end, start + 60)])

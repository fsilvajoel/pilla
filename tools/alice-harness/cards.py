import re
from typing import NamedTuple

# bons motivos para gastar uma busca externa (docs/agents/cartao-de-tarefa.md)
RESEARCH_REASONS = ("regulation", "external-spec", "lib-behavior", "security-advisory")

# Exceção registrada (Joel, 17/11): a Bia implementa um cartão que não compensa para a Alice
# (estourou o toolCalls mesmo refatiado). Só o Joel aprova; sem os três campos, bia + implement continua recusado.
BIA_IMPL_EXCEPTION = "nao-compensa-alice"


def bia_impl_exception(card: dict) -> bool:
    """True quando o cartão é implement da Bia com a exceção aprovada e justificada."""
    return (card.get("kind") == "implement" and card.get("exception") == BIA_IMPL_EXCEPTION
            and bool(str(card.get("exceptionReason") or "").strip())
            and bool(re.fullmatch(r"Joel \d{4}-\d{2}-\d{2}", str(card.get("exceptionApprovedBy") or ""))))


def validate_plan(plan: dict, known_rules: set[str], external_ids: set[str]) -> list[str]:
    problems = []
    
    # Top-level requirements
    if "delivery" not in plan or "cards" not in plan:
        problems.append("plano sem 'delivery' ou 'cards'")
        return problems


    cards = plan.get("cards", [])
    card_ids = set()
    card_map = {}
    
    # First pass: collect IDs and basic structure
    for card in cards:
        cid = card.get("id")
        if not cid:
            problems.append("cartão sem id")
            continue
        
        if cid in card_ids:
            problems.append(f"{cid}: id duplicado")
        card_ids.add(cid)
        card_map[cid] = card

    # Validation of each card
    for card in cards:
        cid = card.get("id")
        if not cid: continue
        
        # Required fields
        for field in ["title", "kind", "assignee", "allowedPaths", "checks", "done"]:
            if field not in card:
                problems.append(f"{cid}: falta o campo {field}")
        
        # ID format
        if cid and not re.match(r"^E\d+-T\d{2}$", cid):
            problems.append(f"{cid}: id fora do formato E<n>-T<nn>")
            
        # Kind
        kind = card.get("kind")
        if kind and kind not in ["implement", "test-author", "pre-review", "docs", "cards", "research"]:
            problems.append(f"{cid}: kind inválido: {kind}")
            
        # Assignee
        assignee = card.get("assignee")
        if assignee and assignee not in ["alice", "claude", "bia"]:
            problems.append(f"{cid}: assignee inválido: {assignee}")
        elif assignee == "bia" and kind != "test-author" and not bia_impl_exception(card):
            # a Bia só escreve teste (cota de 50/dia; travas.md 4.9); exceção: implement aprovado pelo Joel
            problems.append(f"{cid}: assignee bia só em kind test-author (este é {kind}); implement da Bia exige "
                            f"exception: {BIA_IMPL_EXCEPTION}, exceptionReason e exceptionApprovedBy: 'Joel AAAA-MM-DD'")
            
        # Rules
        rules = card.get("rules", [])
        for rule in rules:
            if rule not in known_rules:
                problems.append(f"{cid}: regra inexistente nos docs: {rule}")
                
        # Dependencies
        deps = card.get("dependsOn", [])
        for dep in deps:
            if dep not in card_ids and dep not in external_ids:
                problems.append(f"{cid}: dependência inexistente: {dep}")
                
        # Checks and Done
        checks = card.get("checks")
        done = card.get("done")
        if checks is not None and (not isinstance(checks, list) or len(checks) == 0):
            problems.append(f"{cid}: checks vazio")
        if done is not None and (not isinstance(done, list) or len(done) == 0):
            problems.append(f"{cid}: done vazio")
            
        # Alice + Implement requires protectedTests
        if assignee in ("alice", "bia") and kind == "implement":
            if not card.get("protectedTests"):
                problems.append(f"{cid}: implement da Alice exige protectedTests (TDD)")
                
        # AllowedPaths vs ProtectedTests
        allowed_paths = card.get("allowedPaths", [])
        protected_tests = card.get("protectedTests", [])
        for path in allowed_paths:
            if path in protected_tests:
                problems.append(f"{cid}: {path} é teste protegido e não pode estar em allowedPaths")
                
        # AllowedPaths empty only for pre-review
        if not allowed_paths and kind != "pre-review":
            problems.append(f"{cid}: allowedPaths vazio só em pre-review")
            
        # Small tasks (LI-011): Alice edits at most 2 files; pre-review needs a closed checklist (LI-013)
        if assignee in ("alice", "bia") and kind in ("implement", "test-author") and len(allowed_paths) > 2:
            problems.append(f"{cid}: tarefa da Alice deve ser pequena (até 2 arquivos em allowedPaths)")
        if kind == "pre-review" and not card.get("checklist"):
            problems.append(f"{cid}: pre-review exige checklist (uma linha por item no resultado)")

        # LI-030: "reuse X" in done must come with the import line, or Alice redeclares X
        lines = [str(x) for x in (done or [])] + [str(x) for x in card.get("context", []) or []]
        for line in lines:
            for name in re.findall(r"\breuse\s+([a-z]+[A-Z]\w*)", line):
                if not any(re.search(rf"\bimport\b.*\b{name}\b", other) for other in lines):
                    problems.append(f"{cid}: 'reuse {name}' sem a linha de import (LI-030)")

        # Pesquisa externa só com bom motivo: o fato não está no repositório e cabe numa destas categorias
        if kind == "research":
            why = card.get("why") or {}
            if why.get("category") not in RESEARCH_REASONS:
                problems.append(f"{cid}: research exige why.category em {', '.join(RESEARCH_REASONS)}")
            if len(str(why.get("reason", ""))) < 30:
                problems.append(f"{cid}: research exige why.reason (por que o repositório não responde e o que muda com a resposta)")
            if not card.get("question"):
                problems.append(f"{cid}: research exige question (uma pergunta fechada)")
            if len(allowed_paths) != 1 or not str(allowed_paths[0]).startswith("docs/pesquisa/"):
                problems.append(f"{cid}: research escreve um único arquivo em docs/pesquisa/")

        # Budget
        budget = card.get("budget", {})
        attempts = budget.get("attempts", 0)
        tool_calls = budget.get("toolCalls", 0)
        if attempts > 6:
            problems.append(f"{cid}: budget.attempts > 6")
        if budget.get("minutes", 0) > 15:
            problems.append(f"{cid}: budget.minutes > 15 (tarefa pequena termina rápido)")
        if tool_calls > 30:
            problems.append(f"{cid}: budget.toolCalls > 30")

    # Cycle detection
    visited = set()
    path = set()
    
    def has_cycle(cid):
        if cid in path:
            return True
        if cid in visited:
            return False
        
        visited.add(cid)
        path.add(cid)
        
        card = card_map.get(cid)
        if card:
            deps = card.get("dependsOn", [])
            for dep in deps:
                if dep in card_map:
                    if has_cycle(dep):
                        return True
        
        path.remove(cid)
        return False

    for cid in card_ids:
        if cid not in visited:
            if has_cycle(cid):
                problems.append(f"{cid}: ciclo de dependências")

    return problems


# ---------------------------------------------------------------- card quality (errors of whoever writes the card)
# Each rule below came from a run that failed, paused or was redone because of the card, not of the model.

KNOWN_FIELDS = {"id", "title", "kind", "assignee", "rules", "refs", "dependsOn", "allowedPaths", "protectedTests", "checks",
                "done", "budget", "readFirst", "sizeNote", "checklist", "libs", "think", "refactor", "question", "why",
                "num_predict", "maxOutputTokens", "hints", "generatedPaths",
                "exception", "exceptionReason", "exceptionApprovedBy"}
KNOWN_BUDGET = {"attempts", "toolCalls", "minutes"}
SHELL_TOKENS = {"|", "||", "&&", ";", ">", ">>", "<", "!", "2>&1", "&"}
# same expression the done-line gate of the harness uses (alice.done_line_problems, LI-042)
DONE_LITERAL = re.compile(r"((?:export (?:type|const|function|\*)|import (?:\{|type|\*))[^;]*;)")
PROSE = re.compile(r"(?:\b[a-z]{2,}\b[ ,]+){4,}")
RULE_ID = re.compile(r"\b(RN-[A-Z]\d{2}|CA-\d{2}|T-\d{2})\b")
PATH_TOKEN = re.compile(r"(?<![\w./@-])((?:packages|apps|docs|scripts|tools)/[\w./@-]+\.\w+)")
EDIT_TOOL = re.compile(r"\b(edit_file|write_file|append_file|replace_function)\b")
BARE_FILE = re.compile(r"(?<![\w./-])([\w-]+(?:\.test)?\.(?:ts|tsx|mjs|md|ya?ml|json))\b(?!/)")
MAX_DONE_CHARS = 220
# e4-guardrails C: the hint is a hint, never the solution (E4-T02 carried the check-digit formula)
HINT_FORMULA = re.compile(r"%|\bsum of\b|\btimes\b|=>|\breturn\b|\bfor \(|\bwhile \(|\w\(|`|;")
WHOLE_WRITE = re.compile(r"\bone write_file\b")
# e4-guardrails F: cartão de teste
MAX_TEST_BEHAVIORS = 5
TEST_LITERAL = re.compile(r"(\"[^\"]{3,}\"|'[^']{3,}')")
SOURCE = re.compile(r"\((?:[^)]*\b)?(?:RFC-\d|PRD-\d|ADR-\d|RN-[A-Z]\d|Joel)")
SIZE_NOTE_LINES = re.compile(r"(\d+)\s*(?:linhas|lines)\b")

# ---- modelo de tamanho (erro 15): o único lugar com números de tamanho; todo limite sai de num_ctx/num_predict
DEFAULT_NUM_CTX = 32768     # models.yaml: todos os perfis medidos cabem na GPU com 32k
DEFAULT_NUM_PREDICT = 8192  # o perfil e o cartão (maxOutputTokens) podem trocar
TOKENS_PER_LINE = 12        # TypeScript, aproximado
CHARS_PER_TOKEN = 3.5       # código, aproximado
OUTPUT_SHARE = 0.5          # da resposta; o resto vai para o raciocínio e o JSON da chamada
FILE_SHARE = 0.25           # da entrada: um arquivo inteiro cabe numa leitura (read_file) e ainda sobra para o resto
RULES_SHARE = 0.1           # da entrada: texto das regras do cartão no prompt de sistema
LIB_SHEET_SHARE = 0.03      # da entrada: cada cola de biblioteca
ECHO_SHARE = 0.02           # da entrada: arquivo curto devolvido depois de cada edição (LI-029)


class Size(NamedTuple):
    num_ctx: int             # tokens da janela
    num_predict: int         # tokens da resposta
    call_lines: int          # linhas por chamada de write_file/append_file
    file_lines: int          # linhas do arquivo inteiro
    tool_output_chars: int   # saída de uma ferramenta (cabe um arquivo de file_lines)
    context_chars: int       # histórico antes de compactar: a janela menos a resposta
    rules_chars: int
    lib_sheet_chars: int
    echo_lines: int          # arquivo até este tamanho volta inteiro depois da edição


def output_tokens(card: dict, profile: dict | None = None) -> int:
    """Orçamento de resposta: o cartão (maxOutputTokens) vence o perfil, que vence o padrão."""
    profile = profile or {}
    return int(card.get("maxOutputTokens", card.get("num_predict", profile.get("num_predict", DEFAULT_NUM_PREDICT))))


def size_model(card: dict, profile: dict | None = None) -> Size:
    """Todos os limites de tamanho do harness e do validador, derivados da janela e da resposta do modelo."""
    num_ctx = int((profile or {}).get("num_ctx", DEFAULT_NUM_CTX))
    num_predict = output_tokens(card, profile)
    tokens_in = max(num_ctx - num_predict, 0)
    file_lines = int(tokens_in * FILE_SHARE / TOKENS_PER_LINE)
    return Size(
        num_ctx=num_ctx,
        num_predict=num_predict,
        call_lines=int(num_predict * OUTPUT_SHARE / TOKENS_PER_LINE),
        file_lines=file_lines,
        tool_output_chars=int(file_lines * TOKENS_PER_LINE * CHARS_PER_TOKEN),
        context_chars=int(tokens_in * CHARS_PER_TOKEN),
        rules_chars=int(tokens_in * RULES_SHARE * CHARS_PER_TOKEN),
        lib_sheet_chars=int(tokens_in * LIB_SHEET_SHARE * CHARS_PER_TOKEN),
        echo_lines=int(tokens_in * ECHO_SHARE / TOKENS_PER_LINE),
    )


def write_file_limit(card: dict, num_predict: int = DEFAULT_NUM_PREDICT) -> int:
    """Lines that fit in one write_file answer, derived from the card's output budget."""
    return size_model(card, {"num_predict": num_predict}).call_lines


def _matches(path: str, patterns) -> bool:
    import fnmatch
    return any(path == p or fnmatch.fnmatch(path, p) for p in patterns)


def min_tool_calls(card: dict) -> int:
    """Reads and edits (~8) plus each check run about three times: model, after the fix, cleanup round (E2-T24: 5 checks, 23 calls)."""
    return 8 + 3 * len(card.get("checks") or [])


def quality_problems(card: dict, exists=None, producible: set[str] = frozenset(), packages: set[str] | None = None,
                     line_count=None, num_predict: int = DEFAULT_NUM_PREDICT) -> list[str]:
    """Problems of the card text itself. `exists(path) -> bool`, `line_count(path) -> int | None` and `packages`
    come from the repository when available."""
    import shlex
    cid = card.get("id", "?")
    kind, assignee = card.get("kind"), card.get("assignee")
    allowed = [str(p) for p in card.get("allowedPaths") or []]
    protected = [str(p) for p in card.get("protectedTests") or []]
    read_first = [str(p) for p in card.get("readFirst") or []]
    generated = [str(p) for p in card.get("generatedPaths") or []]
    checks = [str(c) for c in card.get("checks") or []]
    done = [str(d) for d in card.get("done") or []]
    out = []

    def add(msg: str, lesson: str) -> None:
        out.append(f"{cid}: {msg} ({lesson})")

    for k in card:
        if k not in KNOWN_FIELDS:
            add(f"campo desconhecido '{k}': o harness ignora em silêncio (erro de digitação?)", "LI-055")
    for k in card.get("budget") or {}:
        if k not in KNOWN_BUDGET:
            add(f"budget.{k} desconhecido (use attempts, toolCalls, minutes)", "LI-055")

    # --- done: what the model reads as the goal
    for d in done:
        if len(d) > MAX_DONE_CHARS:
            add(f"linha do done com {len(d)} caracteres (máx. {MAX_DONE_CHARS}): uma instrução por linha", "LI-055")
        for lit in DONE_LITERAL.findall(d):
            if lit.startswith("export function"):
                add(f"'export function' no done vira linha literal exigida no arquivo; descreva a assinatura em prosa: {lit[:60]}…", "LI-051")
            elif PROSE.search(re.sub(r"[\"'`].*?[\"'`]", "", lit)):
                add(f"código e texto misturados no done; o portão exige a linha inteira até o ';': {lit[:70]}…", "LI-051")
        if assignee != "alice":
            continue  # the lines below are about what the local model can see and verify
        if EDIT_TOOL.search(d):
            add(f"técnica de edição no done ('{EDIT_TOOL.search(d).group(0)}'): o done é o resultado conferível; a dica vai em hints", "LI-055")
        for name in BARE_FILE.findall(d):
            if not any(p.endswith("/" + name) or p == name for p in allowed + protected + read_first):
                add(f"o done cita {name}, que não está em allowedPaths, protectedTests nem readFirst (dê o caminho)", "LI-024")
        for path in PATH_TOKEN.findall(d):
            if not _matches(path, allowed + protected + read_first):
                add(f"o done cita {path}, que não está em allowedPaths, protectedTests nem readFirst", "LI-030")
    cited = set(RULE_ID.findall(" ".join(done + [str(card.get("title", ""))])))
    missing = sorted(cited - set(card.get("rules") or []))
    if missing and assignee == "alice":
        add(f"regra citada no texto e fora de rules (a definição não é injetada): {', '.join(missing)}", "LI-004")

    # --- checks: what decides done
    for i, c in enumerate(checks):
        try:
            argv = shlex.split(c)
        except ValueError:
            add(f"check {i} não pode ser lido (aspas?): {c[:60]}", "LI-055")
            continue
        if SHELL_TOKENS & set(argv):
            add(f"check {i} usa sintaxe de shell ({', '.join(sorted(SHELL_TOKENS & set(argv)))}); o harness roda sem shell: crie um script", "LI-055")
        if argv[:2] == ["node", "-e"]:
            add(f"check {i} é 'node -e' sem mensagem de erro; use um script que diga o que falta (ex.: scripts/check-count.mjs)", "LI-055")
        if packages is not None:
            for name in re.findall(r"--filter\s+(\S+)", c):
                if name not in packages:
                    add(f"check {i} filtra o pacote {name}, que não existe", "LI-055")
        if exists is not None:
            for path in PATH_TOKEN.findall(c):
                if not exists(path) and not _matches(path, producible | set(allowed) | set(generated)):
                    add(f"check {i} cita {path}, que não existe e nenhum cartão cria", "LI-055")
    ts = any(re.search(r"\.tsx?$", p) for p in allowed)
    if kind in ("implement", "test-author") and ts:
        for word in ("typecheck", "lint"):
            if not any(re.search(rf"\b{word}\b", c) for c in checks):
                add(f"cartão de código TypeScript sem check de {word}", "LI-054")
    if generated and not checks:
        add("generatedPaths sem check que gere os arquivos", "LI-060")
    for g in generated:
        if g in allowed or g in protected:
            add(f"{g} está em generatedPaths e em allowedPaths/protectedTests: escolha um", "LI-060")
    if assignee == "alice" and kind == "implement" and checks and not any(re.search(r"\b(test|vitest|unittest)\b", c) for c in checks):
        add("implement sem check de teste (TDD: o teste protegido decide o pronto)", "LI-025")

    # --- hints (e4-guardrails C)
    hints = [str(h) for h in card.get("hints") or []]
    for h in hints:
        m = HINT_FORMULA.search(h)
        if m:
            add(f"hint com fórmula, algoritmo ou código ('{m.group(0)}'): diga onde está a regra (RFC, arquivo), não a solução: {h[:60]}…", "E4-C")
    if any(WHOLE_WRITE.search(h) for h in hints):
        limit = write_file_limit(card, num_predict)
        noted = [int(n) for n in SIZE_NOTE_LINES.findall(str(card.get("sizeNote", "")))]
        for path in allowed:
            current = line_count(path) if line_count else None
            size = max([n for n in [current, *noted] if n is not None], default=None)
            if size is None:
                add(f"hint pede um write_file de {path} sem tamanho previsto: ponha 'N linhas' no sizeNote (limite {limit})", "E4-C")
            elif size > limit:
                add(f"hint pede um write_file de {path} com ~{size} linhas; cabem {limit} na saída ({int(limit * TOKENS_PER_LINE / OUTPUT_SHARE)} tokens): escreva em partes (write_file + append_file) e tire do hint o \"one write_file\"", "E4-C")

    # --- test-author (e4-guardrails F): o teste barra defeito; precisa ser possível e não refazer o código
    if assignee in ("alice", "bia") and kind == "test-author":
        for path in [p for p in allowed if re.search(r"\.test\.tsx?$", p)]:
            if not any("check-test-quality.mjs" in c and path in c for c in checks):
                add(f"test-author sem o check 'node scripts/check-test-quality.mjs {path}' (asserção vazia, teste impossível)", "E4-F")
        behaviors = [d for d in done if not DONE_LITERAL.search(d) and not re.match(r"(every test fails now|never edit)", d)]
        if len(behaviors) > MAX_TEST_BEHAVIORS:
            add(f"{len(behaviors)} comportamentos no done (máx. {MAX_TEST_BEHAVIORS}): divida o teste em cartões", "E4-F")
        for d in behaviors:
            for lit in TEST_LITERAL.findall(d):
                if not SOURCE.search(d):
                    add(f"valor exato {lit} no done sem fonte (RFC, PRD, ADR, RN ou Joel): valor calculado por quem escreve "
                        f"o cartão é o código de novo; afirme a propriedade ou cite a fonte", "E4-F")

    # --- size and budget
    if assignee in ("alice", "bia") and kind in ("implement", "test-author") and any("*" in p for p in allowed):
        add("allowedPaths com curinga em cartão da Alice: liste os arquivos (até 2)", "LI-011")
    calls = (card.get("budget") or {}).get("toolCalls")
    if assignee == "alice" and kind == "implement" and calls and calls < min_tool_calls(card):
        add(f"budget.toolCalls {calls} < {min_tool_calls(card)} (8 + 3 por check): {len(checks)} checks não cabem", "LI-055")

    # --- files the card points at
    if exists is not None:
        for label, paths in (("readFirst", read_first), ("protectedTests", protected)):
            for path in paths:
                if "*" not in path and not exists(path) and not _matches(path, producible):
                    add(f"{label} cita {path}, que não existe e nenhum cartão cria", "LI-055")

    # --- checklist bound to checks
    keys = [str(i).split()[0] for i in card.get("checklist") or []]
    if len(keys) != len(set(keys)):
        add("checklist com chave repetida", "LI-013")
    for item in card.get("checklist") or []:
        for n in re.findall(r"\brun_check\s+(\d+)", str(item)):
            if int(n) >= len(checks):
                add(f"item {str(item).split()[0]} cita run_check {n}, que não existe (há {len(checks)} checks)", "LI-053")
    return out


# ---------------------------------------------------------------- features (ADR-0014, docs/agents/orquestracao.md)
FEATURE_ID = re.compile(r"^E\d+-F\d{2}$")
FEATURE_KNOWN = {"id", "title", "cards", "biaBudget"}
PLAN_SECTIONS = ("Escopo", "Riscos", "Dependências", "Critérios de aceite", "Cenários")
SCENARIO = re.compile(r"^- (C\d+):\s*(.+)$", re.M)
BIA_BUDGET = (2, 10)  # TEMPORÁRIO (Joel, madrugada 17/11): teto era 3; o Joel revisa e ajusta em 17/11. Não substitui ledger por tentativa de rede


def feature_plan_path(fid: str) -> str:
    return f"docs/plano/{fid}/plano.md"


def plan_scenarios(text: str) -> list[tuple[str, str]]:
    """Cenários do plano.md: linhas '- C<n>: <descrição>' da seção Cenários."""
    part = text.split("## Cenários", 1)[1].split("\n## ", 1)[0] if "## Cenários" in text else ""
    return SCENARIO.findall(part)


def feature_problems(plan: dict, read=None) -> list[str]:
    """Problemas do bloco `features:` do plano. `read(path) -> str | None` lê do repositório (plano.md)."""
    feats = plan.get("features") or []
    cards = {c.get("id"): c for c in plan.get("cards") or []}
    out: list[str] = []
    owner: dict[str, str] = {}
    for f in feats:
        fid = str(f.get("id", "?"))
        if not FEATURE_ID.match(fid):
            out.append(f"{fid}: id de feature fora do formato E<n>-F<nn>")
        for k in f:
            if k not in FEATURE_KNOWN:
                out.append(f"{fid}: campo desconhecido '{k}' na feature (LI-055)")
        ids = [str(c) for c in f.get("cards") or []]
        if not ids:
            out.append(f"{fid}: feature sem cards")
        for cid in ids:
            if cid not in cards:
                out.append(f"{fid}: cartão {cid} não está neste plano")
            elif cid in owner:
                out.append(f"{fid}: {cid} já é da feature {owner[cid]}")
            owner.setdefault(cid, fid)
        members = [cards[c] for c in ids if c in cards]
        tests = [c for c in members if c.get("kind") == "test-author"]
        impls = [c for c in members if c.get("kind") == "implement"]
        if not tests or not impls:
            out.append(f"{fid}: feature precisa de pelo menos um test-author e um implement")
        for c in tests:
            if c.get("assignee") != "bia":
                out.append(f"{fid}: {c['id']} é test-author da feature e precisa de assignee bia (a Bia escreve os testes)")
        produced = {str(p) for c in tests for p in c.get("allowedPaths") or []}
        for c in impls:
            if c.get("assignee") != "alice" and not (c.get("assignee") == "bia" and bia_impl_exception(c)):
                out.append(f"{fid}: {c['id']} é implement da feature e precisa de assignee alice")
            for t in c.get("protectedTests") or []:
                if str(t) not in produced:
                    out.append(f"{fid}: {c['id']} protege {t}, que nenhum test-author da feature escreve")
        budget = f.get("biaBudget")
        if not isinstance(budget, int) or not BIA_BUDGET[0] <= budget <= BIA_BUDGET[1]:
            out.append(f"{fid}: biaBudget {budget!r} fora de {BIA_BUDGET[0]}..{BIA_BUDGET[1]} (requisições da Bia por feature)")
        if read is not None:
            text = read(feature_plan_path(fid))
            if text is None:
                out.append(f"{fid}: falta {feature_plan_path(fid)} (etapa 1, escrito pelo Claude)")
                continue
            for sec in PLAN_SECTIONS:
                if f"## {sec}" not in text:
                    out.append(f"{fid}: {feature_plan_path(fid)} sem a seção '## {sec}'")
            if "## Cenários" in text and not plan_scenarios(text):
                out.append(f"{fid}: a seção Cenários precisa de linhas '- C<n>: <descrição>'")
    return out

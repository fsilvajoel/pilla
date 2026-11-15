import re

# bons motivos para gastar uma busca externa (docs/agents/cartao-de-tarefa.md)
RESEARCH_REASONS = ("regulation", "external-spec", "lib-behavior", "security-advisory")

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
        if assignee and assignee not in ["alice", "claude"]:
            problems.append(f"{cid}: assignee inválido: {assignee}")
            
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
        if assignee == "alice" and kind == "implement":
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
        if assignee == "alice" and kind in ("implement", "test-author") and len(allowed_paths) > 2:
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

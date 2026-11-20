# Harness-adaV1 — plano de reestruturação

Recomeço do harness (`tools/alice-harness`) em uma estrutura que separa **papel, conhecimento, execução e fluxo**.
Por enquanto mora dentro do pilla, mas é montado para virar um harness genérico só movendo a pasta.

## Definições

- **Agente** (`agent/`): quem atua, objetivos e responsabilidades. Conhecimento reutilizável não fica aqui.
- **Skill** (`skill/`): ensina quando e como usar capacidades e Tools, com exemplos, boas práticas e limitações.
  **Todas** as skills ficam aqui.
- **Tool** (`tools/`): executa integrações externas.
- **Workflow** (`workflow/`): a sequência de trabalho, quais agentes, Skills e Tools participam e o critério de conclusão.
- **Gate** (`gate/`): critério que barra ou aprova, documentado no mesmo formato das demais pastas.
- **Script** (`script/`): por enquanto, scripts que facilitam o trabalho de um agente.

Regras de classificação:
- O que é instrução ou modelagem e não precisa ser `.py` vira `.md`.
- Um script que na prática é uma tool vira tool. O mesmo vale para skill.

## Estrutura

```
Harness-adaV1/
  README.md         o que é, como plugar num projeto
  agent/<nome>.md
  skill/<nome>/SKILL.md (+ references/, scripts/ da própria skill)
  tools/<nome>.py   + _contract.py (Protocol) + __init__.py (registro load/list)
  workflow/<nome>.md
  gate/<nome>.md    critério; a checagem roda numa tool ou num script
  script/<nome>.py  motor e ajudantes (dívida: migra para tools/ nas próximas versões)
  tests/
  .env.example
```

Código só existe em `tools/` e `script/`, e cada `.py` tem tipagem forte. Cada tipo de `.md` tem um modelo em `<pasta>/_modelo.md`.

## Portabilidade (para sair do pilla só movendo a pasta)

1. **A pasta fica na raiz do pilla:** `Harness-adaV1/`.
2. **Nada dentro dela cita o pilla.** Não pode haver o nome do projeto, caminho absoluto, `docs/regras` nem `apps/`.
   O gate `portable` testa isso e falha se encontrar `pilla` ou `/home/`.
3. **O projeto se descreve fora da pasta**, em `harness.project.yaml` na raiz do pilla. Ali ficam:
   - os caminhos das regras;
   - a política (`policy.yaml`);
   - os checks padrão;
   - a pasta de saída das execuções;
   - os perfis de modelo do projeto.
4. **As execuções (`runs/`) são gravadas no projeto,** em `.harness/runs/` (gitignored), nunca dentro do harness.
5. **O `.env` do harness** fica em `Harness-adaV1/.env` (gitignored) e vai junto com a pasta quando ela for movida.
6. **Os imports são relativos à raiz do harness.** O ponto de entrada é `python3 Harness-adaV1/script/ada.py --project .`.
7. **A ligação com o Claude Code fica do lado do pilla:**
   - `.claude/skills` é um symlink para `../Harness-adaV1/skill`;
   - o hook do `.claude/settings.json` aponta para o script do harness.
8. **Os testes ficam dentro da pasta** e rodam com um projeto falso em `tests/fixtures/`, sem depender do pilla.
9. **Como extrair depois:** `git subtree split --prefix=Harness-adaV1`. O histórico vem junto, e o pilla passa a apontar para o novo caminho.

## Para onde vai o que existe hoje

| Hoje | Vai para |
|---|---|
| `roles/developer.md` + prompt de sistema do `alice.py` | `agent/alice.md` |
| `roles/qa.md` + prompts do `bia.py` | `agent/bia.md` |
| `roles/planner.md` | `agent/planner.md` |
| papel do Claude (memórias, CLAUDE.md) | `agent/claude.md` |
| `.claude/skills/*` (12) | `skill/*` |
| regras de cartão + `cards.py` (o que ensina) | `skill/escrever-cartao/` |
| `review.py` (o que ensina) | `skill/revisar-teste/` |
| `retro.py` (o que ensina) | `skill/retro/` |
| lições de edição (LI-029, NO_CHANGE...) | `skill/editar-arquivo/` |
| política de domínios e Brave | `skill/pesquisa-web/` |
| custo, tokens e cota da Bia | `skill/orcamento-tokens/` |
| 12 ferramentas de `Tools` | `tools/<nome>.py` (9 prontas, 3 a refazer) |
| chamada ao Ollama (`alice.py`) | `tools/ollama_chat.py` |
| chamada ao OpenRouter (`bia.py`) | `tools/openrouter_chat.py` |
| `_common.run_cmd` | `tools/run_cmd.py` |
| `scripts/check-brave.sh` | `tools/web_health.py` |
| `feature.py` (sequência) | `workflow/feature.md` |
| `plan-run` / um cartão | `workflow/cartao.md` |
| leva e fila | `workflow/leva.md`, `workflow/fila.md` |
| revisão do Claude | `workflow/revisao.md` |
| `cards.py` (validação) | `gate/card-quality.md` |
| `scripts/check_tool.py` | `gate/tool-contract.md` |
| `scripts/guard_hook.py` | `gate/edit-guard.md` |
| `scripts/alice-gate.sh` | `gate/ssh-gate.md` |
| assinatura do `review.py` | `gate/test-reviewed.md` |
| checks do `done` | `gate/done-checks.md` |
| `gates.py` | `gate/gap-feedback.md`, `gate/duplicated.md`, `gate/redact.md` |
| (novo) | `gate/portable.md` |
| laço do agente, `plan-run`, `resume`, `policy`, `rules`, `edits`, `quadro`, `metrics`, `claude_usage` | `script/` (dívida) |
| `scripts/run-batch.sh`, `tasks/*.yaml` | removidos (o plan-run substitui) |

## Fases

Cada fase termina com a suíte verde e um commit próprio. A ordem segue a dependência.

| Fase | O quê | Quem | Pronto quando |
|---|---|---|---|
| 0 | Snapshot da VM <vm>; esqueleto das 6 pastas, `_modelo.md` por tipo, `harness.project.yaml`, gate `portable` | Claude | `portable` verde, suíte antiga verde |
| 1 | `agent/` e `workflow/`: tirar papéis e sequências do código para `.md` | Claude | cada agente e workflow com modelo preenchido; o motor ainda não lê os arquivos |
| 2 | `skill/`: mover as 12 skills, symlink `.claude/skills`, escrever as 6 novas | Alice rascunha, Claude revisa | o Claude Code lista as skills pelo symlink |
| 3 | `tools/`: as 9 prontas, refazer `list_files`/`replace_function`/`fetch_page`, `ollama_chat`, `openrouter_chat`, `run_cmd`, `web_health` | Alice, um cartão por item com check de equivalência | `tool-contract` verde em todas |
| 4 | `gate/`: os `.md`, com a checagem apontando para a tool ou o script | Claude | cada gate com teste |
| 5 | `script/`: o motor lê `agent/*.md`, o registro de tools e `harness.project.yaml`; trocar `package.json`, hook e `settings.json` | Claude | uma fila real roda pelo `Harness-adaV1` |
| 6 | Paridade: os 314 testes no novo; apagar `tools/alice-harness` | Claude | suíte nova verde, nada aponta para o caminho antigo |

Sobre o custo: movimentação mecânica vai por `git mv`, feita pelo Claude. A Alice só recebe o que tem check automático
(equivalência, contrato), porque a E90 mostrou que delegar uma mudança mecânica sem esse check sai mais caro.

## Fora do escopo desta versão
- Tirar o motor de `script/` para virar tools.
- Repositório próprio, depois da extração (item 9 de Portabilidade).

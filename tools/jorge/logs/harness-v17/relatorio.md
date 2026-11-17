# harness-v17 — checkpoint por cartão, aviso de orçamento e reset de etapa

## Identificação

- **Versão:** harness-v17
- **Data:** 2026-11-17
- **Execução:** aplicado pelo substituto temporário (Claude subagente) por autorização do Joel em 17/11, a partir da proposta do Jorge (`relatorio-proposta.md`), mais o comando de reset pedido pelo Joel.
- **Estado da versão:** aplicada (commit local em `docs/mvp-planning`, sem push).
- **Base git:** `49419c8f3dbf92a7f58867a810c98ec26784b6b5` (`docs/mvp-planning`).
- **Autorizações de Joel:** aplicar JV17-1..5 e acrescentar `feature reset`. Sem alterar `toolCalls`, grace, `biaBudget`, checks ou cobertura (0/0 continua falha); sem tocar `docs/plano/**`, `apps/**`, `packages/**`, `tools/jorge/*.py`.
- **Suíte de referência:** VERDE, 278 testes (`python3 -m unittest discover -s tests` no harness).

## Evoluções

| ID | Problema | Mudança | Arquivos | Teste que prova | Status |
|---|---|---|---|---|---|
| JV17-1 | rollback integral descartava done e a retomada repetia T02 | `implement` cartão a cartão quando os allowedPaths são exatos: checkpoint antes de cada cartão, snapshot com manifest sha256 no done, rollback só do cartão que falhou (diferenças vão para `previous/`), dependentes `skipped`; retomada pula só o prefixo done com snapshot íntegro, mesmo cartão, mesmos `testShas` e árvore igual ao último snapshot; senão refaz do HEAD (fail-closed). Glob nos allowedPaths mantém o comportamento antigo. `cmd_run` não volta ao HEAD quando o cartão traz `keepWorktree` (injetado só pelo orquestrador) | `feature.py`, `alice.py`, `tests/test_feature_orchestrator.py` | done A + failed B no mesmo arquivo conserva A e reexecução chama só B; snapshot adulterado, teste mudado, código desfeito e estado legado refazem tudo; check vermelho não dá done | aplicada |
| JV17-2 | aviso de orçamento tardio | `CallBudget.warning()`: a 70% (teto arredondado para cima) do limite, uma vez por tentativa, "restam N chamadas; feche: rode os checks e entregue" no resultado da chamada; no limite, o harness roda o check final sozinho e anexa verde/vermelho ao pedido de `finish`. `toolCalls` e grace intocados | `gates.py`, `alice.py`, `tests/test_no_op_and_budget.py` | aviso com N correto e uma vez só; check automático vermelho/0/0 continua failed | aplicada |
| JV17-3 | writes repetidos fora do escopo | mensagem de bloqueio com allowedPaths e destino provável (`write_target`); 2º bloqueio seguido no mesmo caminho vira "pare de tentar X"; contador zera após operação permitida | `alice.py`, `tests/test_no_op_and_budget.py` | dois bloqueios seguidos e reset do contador; escopo protegido segue bloqueado | aplicada |
| JV17-4 | retro sem diagnóstico | relatório do cartão com `toolsByKind` (read/write/run_check/bloqueadas) e `lastRedCheck` (redigido, limitado, vazio em done); retro com coluna por tipo (fallback pelo log em registros antigos) e seção "Última saída vermelha" | `alice.py`, `retro.py`, `tests/test_retro.py`, `tests/test_no_op_and_budget.py` | falha mostra categorias e última saída; sucesso não herda saída antiga | aplicada |
| JV17-5 | dúvida `-t` e cobertura parcial | só caracterização e documentação; nenhum check afrouxado | `tests/test_test_guardrails.py`, `tests/test_feature_orchestrator.py`, `docs/agents/orquestracao.md` | check não-final com `-t` e saída 0/0 passa com rc 0 e falha com rc 1; `review` sem check final de cobertura termina em erro 17 | aplicada |
| Reset | reabrir etapa exigia editar `estado.json` (erro 16) | `alice.py feature reset <plano.yaml> <F> --stage tests\|implement [--cards ID,...] --repo <repo> --motivo "<texto>"`; ver `docs/agents/orquestracao.md` | `feature.py`, `alice.py`, `tests/test_feature_orchestrator.py`, `docs/agents/orquestracao.md` | tests reabre tests+dependentes mantendo biaRequests; motivo vazio/etapa inválida/`--cards` em tests não mexem no estado; reset de cartão volta ao checkpoint do anterior; sem checkpoint restaura HEAD de todos | aplicada |

### Observações

- `keepWorktree` em `cmd_run` não tem teste unitário próprio; está coberto indiretamente pelo teste do orquestrador que confere o campo no cartão repassado ao `plan_run`.
- Estados de feature anteriores ao v17 (ex.: E6-F01) não têm snapshot: `--stage implement`/`all` refaz todos os cartões a partir do HEAD (inclusive T02). O reset é a alternativa para reabrir de forma registrada.
- Reabrir testes de E7-F03: `alice.py feature reset docs/plano/E7.yaml E7-F03 --stage tests --repo <repo> --motivo "..."` e depois `--stage tests`.
- Nada em `docs/plano/**` foi alterado; nenhum `estado.json` real foi tocado.

## Execução e suíte

| Momento | Resultado | Executados | Falhas | Erros |
|---|---|---:|---:|---:|
| Referência (antes) | VERDE | 278 | 0 | 0 |
| Após evoluções (final) | VERDE | 299 | 0 | 0 |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Desvios:** nenhum impedimento do hook; nenhum item parado por insegurança.

## Custo da execução

| Medida | Valor | Observação |
|---|---:|---|
| Modelo | Claude Opus 5.5 (subagente) | sem Jorge/Abacus |
| Tokens / requisições | indisponível no subagente | medir pelo transcript da sessão |
| Consumo de Bia | 0 | nenhuma chamada |
| Consumo de Alice | 0 | nenhuma chamada |
| Suítes rodadas | várias parciais + 3 completas | referência, intermediária e final |

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

## v17.1 (17/11, substituto)

Substituto temporário do Jorge, por decisão do Joel (17/11): E6-T07, E7-T09 e E7-T10 passam a ser implementados
pela Bia, como exceção registrada. As regras gerais continuam as mesmas.

| Item | O que mudou | Onde |
|---|---|---|
| Exceção no validador | `assignee: bia` + `kind: implement` só com `exception: nao-compensa-alice`, `exceptionReason` não vazio e `exceptionApprovedBy: "Joel AAAA-MM-DD"`. Sem esses campos, a recusa continua; a exceção não vale para outros kinds; `protectedTests` passa a ser obrigatório também nesse caso | `cards.py` (`bia_impl_exception`) |
| Escritor | `bia.write_impl` / `bia.py impl`: até 3 rodadas (pedido → arquivos dos `allowedPaths` exatos → Prettier → checks, com o vermelho de volta como feedback). Recusa teste protegido e glob; pré-voo antes de gastar | `bia.py` |
| Portão | local: os checks do cartão (cobertura 0/0 continua falha). A Bia não revisa o próprio código. Na feature, seguem a auditoria e a revisão final do Claude | `alice.run_card` (rodada sem revisão) |
| Orçamento | o orquestrador passa `biaCap = biaBudget − biaRequests`, e o `plan_run` desconta o que os cartões anteriores gastaram. Cada requisição (com os retries de rede) entra em `biaRequests` da feature e da etapa. Com cap 0, o cartão fica `escalated` sem chamar a Bia; se o orçamento acaba no meio, também fica `escalated`. `toolCalls` e grace não foram alterados | `feature.py` (`bia_cap`, `charge_bia`), `alice.py` |
| Checkpoint | o cartão da Bia passa pelo mesmo `implement_by_card`: checkpoint, snapshot no done e rollback na falha | sem mudança |
| Cartões | E6-T07, E7-T09 e E7-T10 com a exceção; E7-F03 `biaBudget` 4 → 7; E6-F01 continua em 8; `BIA_BUDGET=(2,10)` mantido | `docs/plano/E6.yaml`, `E7.yaml` |
| Docs | travas.md 4.9 (nova linha) e orquestracao.md (etapa 3 e parágrafo "Implement pela Bia") | `docs/agents/` |

Suíte: 299 (referência, verde) → 314 (verde), com 15 testes novos em `tests/test_bia_implement.py`.
Validação: `alice.py cards` deu ok para E6 e E7. `alice.py prompt` montou o prompt dos 3 cartões. O pré-voo dos 3, com os `testShas` da feature, ficou limpo.
Retomada: o E6-F01 reaproveita o snapshot do E6-T02 (`reusable` = [E6-T02]), então não é preciso reset. O E7-F03 não tem cartão done e recomeça do HEAD.
Risco: o cap do implement não reserva a auditoria. Se a Bia gastar todo o restante (E6-F01: 5, E7-F03: 4), a etapa audit para em `quota`.
Fora do escopo: `docs/agents/cartao-de-tarefa.md:16` ainda diz "bia só em kind test-author". Falta mencionar a exceção (é arquivo do Jorge/Claude).

# Orquestração por feature: Claude planeja e revisa, Bia testa e audita, Alice implementa

Decisão: [ADR-0014](../adr/0014-orquestracao-por-feature.md). Esta página é o desenho e a referência de operação.
A evolução é incremental: tudo o que o harness já faz por cartão continua valendo (plano YAML, validador, Guard,
política, verificação no `finish`, pré-voo, `plan-run --rounds`, retro, `cost`/`claude-usage`, hooks). A feature
é uma camada **por cima** do `plan-run`, não um caminho paralelo.

## Por que mudar (números medidos)

| Problema | Medida | Resposta |
|---|---|---|
| Claude no laço entre rodadas | E4-T03 à mão: 330 turnos, ≈5M tokens, 64% releitura | o orquestrador roda as etapas 2–4 sozinho; o Claude entra só no plano e na revisão final |
| Alice escreve teste mal | E4-T03: 10 rodadas sem aprovação | teste é da Bia (QA), por feature, num lote |
| Pré-revisão local como portão final | rodada 12: 3 reprovações sem nenhuma nota com apoio no pronto | reprovação local sem nota com apoio no pronto **não conta** (código 5, inconclusivo → `escalated`); na feature ela não é portão |
| Bia por cartão e por rodada | rodadas 11–12: 5 requisições num cartão | Bia por feature, com orçamento declarado (`biaBudget`, 2 a 3 chamadas; retries de rede não têm ledger independente) |
| Quem escreve o teste também audita | conflito de papéis | auditoria apoiada em números mecânicos (expect-red, cobertura, checks) e aprovação final do Claude |

## Papéis (instruções fixas em `tools/alice-harness/roles/`)

| Papel | Quem | Faz | Não faz |
|---|---|---|---|
| Planner / Tech Lead | Claude | `plano.md` da feature (escopo, riscos, dependências, critérios de aceite, cenários), cartões, revisão final e commit | código de produto ou teste no fluxo normal |
| QA / Test Designer | Bia (OpenRouter, `nvidia/nemotron-3-ultra-550b-a55b:free`) | todos os testes da feature num JSON; auditoria de cobertura e edge cases | implementação; chamada por cartão, rodada ou linha |
| Developer | Alice (Qwen local, `ALICE_PROFILE=qwen35`) | implementa até os checks passarem, dentro do Guard | teste (os `protectedTests` são só leitura para ela) |

## Fluxo

No ciclo de sprint de [AGENTS.md §3.1](../../AGENTS.md), Joel e Claude aprovam o planejamento (PRD/ADR/RFC);
no refinamento Claude fatia cartões (`alice.py cards` verde) e Bia detalha cenários com IDs de regras.
No desenvolvimento Bia escreve **todos** os testes da feature e eles precisam estar prontos e revisados
**antes** de começar os cartões da Alice. Depois seguem validação/review (checks, auditoria Bia,
revisão final Claude), entrega (Claude: commit/push/PR; Joel: aprovação/merge) e retrospectiva
por feature (custos Claude × Alice × Bia, ajustes do processo pelo Jorge fora da fila e plano da próxima sprint).
Problemas de processo vão à caixa do Jorge, não são corrigidos durante a entrega.
Ao retomar, Claude, Alice e Bia consultam [quadro.md](quadro.md) para estado resumido, em vez de varrer logs.
É uma fotografia manual datada: Claude registra `alice.py leva "<texto>"` e
`alice.py fila <alice|bia|jorge> "<itens>"` e então executa `alice.py quadro`.
Fonte ausente aparece como `?`; data antiga exige nova geração. Retros e relatórios continuam fonte de auditoria.

A tabela abaixo descreve as etapas **internas** do comando `feature`, não os seis marcos da sprint.

| # | Etapa | Quem | Artefato (`docs/plano/<F>/`) | Requisições da Bia |
|---|---|---|---|---|
| 1 | Plano | Claude | `plano.md`, validado por `alice.py cards` | 0 |
| 2 | Testes | Bia, 1 chamada com o plano + contratos de **todos** os cartões test-author; checks mecânicos; ≤1 reparo em lote | `testes.md` (cenário → teste, checks) | 1 + ≤1 |
| 3 | Implementação | Alice, `plan_run` dos cartões implement (local; as notas vêm dos checks) | `runs/retro-*.md` | 0 |
| 4 | Auditoria | Bia, 1 chamada: plano, testes, diff, cobertura, expect-red; extraTests em lote → validador e checks → Alice de novo; ≤1 ciclo | `auditoria.md`, `docs/plano/revisao/<ID>.md` | 1 + ≤1 |
| 5 | Revisão final | Claude: lê `revisao-final.md` e o diff, decide, commita com `Card-Done` | `revisao-final.md` | 0 |

Comando: `alice.py feature <plano.yaml> <F> [--stage plan|tests|recheck-tests|implement|audit|review|all] [--rounds N]`
(reabrir etapa: `alice.py feature reset ...`, abaixo).
O estado fica em `docs/plano/<F>/estado.json` (etapa, status, chamadas declaradas e tokens por etapa);
rodar de novo continua da etapa pendente. `--stage plan` só valida o plano (o plano é do Claude).
Para respeitar a revisão dos testes antes da Alice, rode `--stage tests`, revise os testes e só então
rode `--stage implement` (seguido de `audit` e `review`); o `--stage all` atual **não interrompe**
entre tests e implement nem prova aprovação externa: não o use como portão dessa revisão.
Com testes já produzidos e `tests: done`, `error` ou `escalated`, Claude pode executar `--stage recheck-tests`
após correção externa ou mudança no plano: reexecuta todos os checks sob o stub HEAD sem pedir à Bia nem
sobrescrever testes, exige arquivos e cenários registrados do plano atual, atualiza os shas e só marca
`tests: done` em verde. Falha de evidência ou de check bloqueia a implementação, inclusive se antes estava done. `all` não faz essa revalidação sozinho;
erro de typecheck/lint de pacote permanece vermelho até ser resolvido, mesmo que seja de outra feature.
Antes de qualquer etapa que execute agentes (exceto `plan`), dependências de cartões em outra feature do mesmo plano
exigem estado do produtor com `implement: done` e o cartão dependido em `implement.cards` como `done`;
estado ausente, inválido ou ambíguo bloqueia a feature sem consumir Bia/Alice. Antes dos checks compartilhados
de `tests`, entregas antigas de teste saem da árvore e ficam em `runs/feature/<F>/.../previous/`.
**Checkpoint por cartão (harness-v17, JV17-1).** Quando os allowedPaths de implementação são caminhos exatos
(sem glob), `implement` roda **um cartão por vez**: antes de cada um grava um checkpoint dos arquivos
(`runs/feature/<F>/snapshots/<ID>/`, manifest com sha256); cartão `done` vira snapshot verificável; cartão que falha
volta só ao checkpoint dele (o que difere vai antes para `previous/`), então o trabalho de um `done` anterior no
mesmo arquivo fica na árvore. Os dependentes do que falhou ficam `skipped (dependência falhou)`. Na retomada
(`--stage implement` ou `all`) só é pulado o **prefixo** de cartões `done` com snapshot íntegro, mesmo cartão,
mesmos testes (`testShas`) e o último snapshot igual à árvore; qualquer dúvida (estado legado sem snapshot,
código desfeito, plano ou teste mudado) refaz todos a partir do HEAD (fail-closed). Check vermelho, 0/0 ou erro de
checkpoint/rollback nunca dão `done`. Com glob nos allowedPaths vale o comportamento antigo: lote a partir do HEAD
e, se falhar, cópias preservadas e restore ao HEAD de todos os allowedPaths de implementação; `implement: done`
só é reaproveitado se o mapa de cartões concluídos corresponder exatamente ao plano atual. Testes da Bia não são
restaurados nessa etapa e a Bia não é chamada automaticamente.

**Reabrir uma etapa (reset).** Nunca editar `estado.json` à mão (erro 16). Use:
`alice.py feature reset <plano.yaml> <F> --stage tests|implement [--cards ID,...] --repo <repo> --motivo "<texto>"`.
Não chama agente. `--motivo` é obrigatório; `--stage` só aceita `tests` ou `implement`.
- `tests`: volta `tests` a `pending`, zera `testShas`/`expectRed` e invalida `implement`, `audit` e `review`
  (não aceita `--cards`; os arquivos de teste ficam na árvore e o próximo `--stage tests` os substitui).
- `implement` (sem `--cards`, todos): restaura ao HEAD os allowedPaths de implementação e volta todos os cartões a `pending`.
  Com `--cards`, se o cartão anterior ao primeiro escolhido está `done` com snapshot íntegro, a árvore volta a esse
  checkpoint e só os cartões dali em diante voltam a `pending`; sem checkpoint válido, restaura ao HEAD e todos voltam.
  Em ambos, `audit` e `review` são invalidados; arquivos alterados vão antes para `previous/`.
- O custo já gasto (requisições/tokens da Bia e da Alice) fica no estado; cada reset é registrado em
  `estado.json` → `resets` (quando, etapa, cartões, motivo, arquivos).

Exemplos: retomar E6-F01 (estado anterior ao v17, sem snapshot): `--stage implement` refaz T02 e os demais do HEAD;
para refazer só a partir de um cartão, `reset --stage implement --cards <ID>` (precisa de snapshot do anterior).
Reabrir os testes de E7-F03: `reset --stage tests --motivo "..."` e depois `--stage tests`.

**Dentro do cartão (JV17-2..4).** A 70% do limite de chamadas, o resultado da ferramenta traz
"restam N chamadas; feche: rode os checks e entregue" (uma vez por tentativa). No limite, o harness roda o check
final sozinho (sem gastar chamada nem subir teto/grace) e manda o resultado junto do pedido de `finish`. Escrita
bloqueada responde com os allowedPaths e o destino provável; no 2º bloqueio seguido no mesmo caminho, "pare de tentar X".
O relatório do cartão traz `toolsByKind` (read/write/run_check/bloqueadas) e `lastRedCheck` (última saída vermelha,
redigida e limitada; vazio em `done`); a retro mostra as duas coisas.

**Cobertura em checks filtrados (JV17-5, caracterização).** Check não-final com `-t` e sem `--coverage` passa só
se o comando sair verde e não impõe cobertura do arquivo; o check final precisa de cobertura real, e 0/0 é falha.
Sem cobertura final, `review` termina em erro 17.
O orquestrador nunca commita. O teto declarado não impede retries de rede nem substitui ledger externo.

## Formato das mensagens (JSON com esquema fixo, validado em `feature.py`)

- **Testes (Bia):** `{"files":[{"path","content"}], "scenarios":[{"id","descricao","card","teste"}]}`. `path` só
  nos `allowedPaths` dos test-author da feature; todos os arquivos presentes; todo cenário do plano mapeado.
- **Reparo (Bia):** o mesmo esquema, com todos os erros de checks juntos numa mensagem.
- **Auditoria (Bia):** `{"verdict":"aprovado"|"complementar", "gaps":[{"cenario","explicacao"}],
  "extraTests":[{"path","content"}], "itens":{"<ID>":[{"n","ok","onde"}]}}`.
- Saída fora do esquema: **1** nova tentativa com o erro do esquema; depois `error` com motivo no retro e no estado.

## Cache e reuso de contexto

- Prompts da Bia: prefixo estável primeiro (`roles/qa.md` + regras do projeto + `plano.md` + contratos dos
  cartões), estável entre as chamadas autorizadas da feature; a instrução da etapa e o variável (erros, diff, cobertura) por
  último. O reparo continua a mesma conversa (prefixo igual byte a byte).
- Prompt da Alice: **mantido** como está (`Run.system_prompt`). Dentro de um cartão ele não muda entre chamadas,
  então o Ollama já reaproveita o prefixo. Reordenar as seções para cache entre cartões contrariaria a LI-055
  ("o que decide o pronto vem antes de como fazer") e mudaria um pedido lapidado em 60+ lições; fica como
  problema aberto, a medir.

## Critérios de decisão

| Situação | Decisão |
|---|---|
| `alice.py cards` com problema no plano ou na feature | não roda; erro de quem escreveu (Claude) |
| cota restante ≤ `BIA_RESERVE` (5) ou orçamento da feature esgotado | etapa para com status `quota`; nada é chamado |
| checks vermelhos após o reparo em lote | etapa 2 `escalated`; implementação não começa |
| resposta da Bia fora do esquema 2× | `error` com o motivo; o Claude decide (cartão, harness ou modelo, regra 22) |
| implement `failed`/`escalated` | etapa 3 para; auditoria não gasta requisição |
| auditoria `aprovado` sem extraTests e checks verdes | etapa 5 |
| extraTests reprovados no validador ou nos checks do teste | descartados, registrados em `auditoria.md`; o Claude decide |
| extraTests aceitos | Alice roda o implement de novo (local); re-auditoria só se sobrar orçamento (≤1) |
| pré-revisão local reprova sem nota com apoio no pronto | não conta (inconclusiva); no `plan-run` vira `escalated` direto |
| **Quando o Claude entra** | planejamento/refinamento, revisão dos testes antes da Alice (procedimento externo ao `all`), revisão final e qualquer `escalated`/`error`/`quota` |
| **Quando gastar a Bia** | só nas etapas 2 e 4, por feature, com checks verdes antes da auditoria |

## Arquivo por arquivo

| Arquivo | Mantém | Muda / novo | Por quê |
|---|---|---|---|
| `docs/plano/E*.yaml` | cartões, campos, `assignee`, `kind` | novo bloco opcional `features:` (`id`, `title`, `cards`, `biaBudget`) | mínimo que agrupa cartões sem mudar um cartão |
| `cards.py` | todas as regras de cartão | `feature_problems`: cartões existem, sem feature dupla, `biaBudget` 2–3, `plano.md` com as seções; implement da feature protegido por test-author da mesma feature | erro de plano aparece antes de gastar |
| `alice.py` | `run`, `plan-run`, retro, Guard, pré-voo | subcomando `feature`; pré-voo aceita teste ainda não commitado **só** com o sha que a etapa 2 gravou (`featureTests`) | a etapa 3 roda antes do commit dos testes |
| `bia.py` | `card`, `test`, `write`, `gate`, cota, reserva, consenso, `grounded` | `chat` aceita o histórico (reparo); `local_gate` com reprovação sem nota com apoio no pronto devolve 5 (inconclusivo) | rodada 12 do E4-T03 |
| `review.py` | assinatura amarrada ao sha, `rejection_notes` | assinatura `auditoria-bia` vale só com resposta bruta de feature e números mecânicos (expect-red e checks verdes) | conflito de papéis mitigado por números |
| `feature.py` (novo) | — | estado, esquemas, etapas 2–5, artefatos | orquestrador reaproveita `plan_run`, `bia.chat`, `run_checks`, `restore_allowed`, `format_touched` |
| `roles/{planner,qa,developer}.md` (novo) | textos de `TEST_RULES`, `WRITE_RULES`, `KIND_NOTES` | instruções fixas por papel | prefixo estável |
| `travas.md` 4.9 | histórico de "quem escreve não é o portão" | nova linha da feature | registro do ajuste |
| `cartao-de-tarefa.md` | regras 1–23 | seção "Feature" | onde o Claude escreve |

Lições citadas: LI-025 (check vermelho no pré-voo), LI-052 (prettier do harness), LI-055 (pedido), LI-056
(pré-voo), erro 11 (quem escreve não aprova), erro 15 (limite em um lugar só).

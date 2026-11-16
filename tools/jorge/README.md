# Jorge — mantenedor único do harness

Decisão do Joel (16/11/2026): o **Jorge** é o único agente que altera o harness (`tools/alice-harness/**`, `docs/agents/**`, `.agents/policy.yaml`). Roda via Abacus RouteLLM (GPT-6). O papel foi modelado pelo GPT-6 Astra (`modelagem/`). O Claude é bloqueado por hook (`nucleo/guarda_claude.py`) de editar o harness e tudo em `tools/jorge/`, e de ler os logs do Jorge.

## Duas partes
| Parte | Quem altera | O que tem |
|---|---|---|
| `nucleo/` + `jorge.py` | **só o Joel** | runner, invariantes, travas, portões finais, commit/integração/push, teto de créditos, gatilho, hook do Claude, units systemd |
| `agente/` | **o Jorge** (registrado no relatório) | prompt (`jorge.md`), modelo do relatório, `config.yaml` (modelo e limites, dentro dos tetos do núcleo) |

## Quando roda
- **Automático** (timer systemd de usuário, de hora em hora): `jorge.py auto` dispara um Review quando uma feature em `docs/plano/*/estado.json` fica com todas as etapas `done` e ainda não foi revista, quando aparece retrospectiva nova (`runs/retro-*.md`) desde o último Review, ou quando a caixa de entrada tem itens e o último Review foi há ≥ 20 h. Pula se a Alice estiver ocupada, se o checkout tiver mudança não commitada no harness/Jorge ou se já houve 3 Reviews automáticos no dia (o `review` manual não tem limite).
- **Caixa de entrada:** `python3 tools/jorge/jorge.py anotar "<problema observado>"` (Claude ou Joel). Vai junto no próximo Review.
- **Manual:** `python3 tools/jorge/jorge.py review --escopo <arq|texto> [--retro ...] [--modelo gpt-6-astra]`.

## Contrato com o Claude
Uma linha, `JORGE_STATUS=<status> versao=<v> [motivo=...] [push=...]`, e o código de saída:

| Status | Código | Significado |
|---|---|---|
| `aplicada` | 0 | evoluções commitadas e integradas (`--ff-only`, rebase se a base andou) e push |
| `sem_mudancas` | 10 | só o relatório foi commitado |
| `nada_a_fazer` | 11 | gatilho sem novidade, Alice ocupada, checkout sujo, limite diário ou outra execução |
| `nao_aplicada` | 20 | reprovou mesmo após as rodadas de reparo e a reversão parcial; código revertido, relatório commitado, `motivo=` diz o porquê |
| `erro` | 40 | falha do runner (detalhe no log, para o Joel) |

Perguntas do Jorge vão **para o Joel, no relatório**, sem bloquear. O Joel acompanha pelos pushes no GitHub (`tools/jorge/logs/harness-vN/relatorio.md`).

## Regras mecânicas do núcleo
- **Invariantes** (bloqueio na escrita e no diff final): nunca mudam `docs/plano/**`, `.env` real (o `.env.example` pode), `.claude/**`, `nucleo/`, `jorge.py`, `logs/`, `apps/**`, `packages/**`, `runs/**`. Fora de `tests/`, orçamento/cota da Bia não sobe; valor novo ≤ 3.
- **Travas** (guard_hook, política, linhas de orçamento): aplicadas, mas num commit separado com trailer `Trava: sim` para o Joel auditar (`git log --grep 'Trava: sim'`).
- Worktree isolado (`../.jorge-wt/<versão>`), suíte de referência antes (vermelha não bloqueia: consertá-la vira prioridade), suíte verde (ou menos falhas que uma referência vermelha) e contagem ≥ referência no fim; se reprovar, o Jorge recebe os problemas e tem rodadas de reparo; depois disso só os arquivos que violaram invariante são revertidos e o resto é verificado de novo; lock contra execução dupla, teto de créditos por Review, commits pelos hooks (nunca `--no-verify`). O push não leva commit de outro agente que esteja pendente.

## Instalar o timer
```bash
cp tools/jorge/nucleo/systemd/jorge-auto.* ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now jorge-auto.timer
```

## Testes do núcleo
`python3 -m unittest tools/jorge/nucleo/test_jorge.py` (da raiz do repositório).

# Jorge — mantenedor único do harness

Decisão do Joel (16/11/2026): o **Jorge** é o único agente que altera o harness (`tools/alice-harness/**`, `docs/agents/**`, `.agents/policy.yaml`). O Claude fica bloqueado por hook (`guarda_claude.py`). O Jorge roda via Abacus RouteLLM (GPT-6; padrão `gpt-6-sol`, ver `config.yaml`). O papel foi modelado pelo GPT-6 Astra (`modelagem/`).

## Quando roda
A cada **Review do processo** (fim de leva ou feature). Quem dispara (Claude ou Joel) escreve o escopo: o que deu errado, a lista de problemas do harness congelado e os pedidos do Joel.

```bash
python3 tools/jorge/jorge.py review --escopo escopo.md [--retro tools/alice-harness/runs/retro-X.md ...] [--modelo gpt-6-astra] [--travas-aprovadas]
```

`--travas-aprovadas` libera mudanças em travas (guard_hook, política, orçamento da Bia). **Só o Joel decide usar.**

## Contrato com o Claude
O Jorge **não reporta ao Claude**. A saída é uma linha e um código de saída:

| Status | Código | Significado |
|---|---|---|
| `aplicada` | 0 | evoluções commitadas (`feat(alice-harness): harness-vN by jorge`) e integradas com `--ff-only` |
| `sem_mudancas` | 10 | relatório commitado, nenhuma mudança de código |
| `nao_aplicada` | 20 | suíte, escopo ou trava reprovou; código revertido, relatório commitado |
| `pergunta` | 30 | o Jorge precisa de uma decisão: ler só `logs/<versão>/pergunta.md` e responder com `jorge.py responder <versão> --resposta "..."` |
| `erro` | 40 | falha do runner (detalhe no log, para o Joel) |

Perguntas são exceção. Relatório, conversa, diff, suítes e custo ficam em `logs/<versão>/`. Só `relatorio.md` vai para o git, para o Joel ler no GitHub.

## Segurança do runner
- Trabalha num worktree isolado (`../.jorge-wt/<versão>`, branch `jorge/<versão>`) a partir do HEAD. O checkout principal só recebe merge `--ff-only`.
- Fases controladas pelo runner: ANÁLISE (só leitura, `submit_report`) e depois APLICAÇÃO (escrita restrita, `run_tests`, `finish`).
- Antes da análise roda a suíte de referência; vermelha bloqueia. No final exige suíte verde, contagem ≥ referência, diff só em área permitida e trava só com aprovação.
- Sem `.env`; dos `runs/`, só `retro-*`. Lock impede duas execuções ao mesmo tempo. Commits passam pelos hooks (nunca `--no-verify`).
- O próprio Jorge (`tools/jorge/**`) não é editável por ele nem pelo Claude: mudança aqui é do Joel.

## Arquivos
- `jorge.md`: prompt de sistema. `relatorio-modelo.md`: modelo do relatório de versão. `config.yaml`: modelo, limites e caminhos.
- `jorge.py`: runner. `guarda_claude.py`: hook do Claude. `modelagem/`: pedido ao GPT-6 e notas dele sobre o runner.

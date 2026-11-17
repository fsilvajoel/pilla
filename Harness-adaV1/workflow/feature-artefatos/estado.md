# estado.json de uma feature

Fica em `docs/plano/<feature>/estado.json` e diz em que ponto a feature está. Quem grava: o **orquestrador**
(sessão principal do Claude Code, ao fechar cada etapa) e o **script de gates** (`pnpm gate <nome> <feature>`,
nos campos `gates` e `testShas`). Subagente não edita este arquivo.

```json
{
  "feature": "E4-F04",
  "stages": {
    "plan":       {"status": "done"},
    "tests":      {"status": "done"},
    "testReview": {"status": "done", "verdict": "aprovado"},
    "implement":  {"status": "running"},
    "review":     {"status": "pending"}
  },
  "tests": ["<pacote>/src/log/redact.test.ts"],
  "scenarios": [{"id": "C1", "criterio": "A1", "teste": "mascara o CPF no log"}],
  "testShas": {"<pacote>/src/log/redact.test.ts": "eb4282ab..."},
  "gates": {
    "expect-red": {"status": "PASS", "at": "2026-11-17T12:00:00.000Z", "detail": "3 de 3 testes falharam"}
  }
}
```

## Campos
- `feature`: ID da feature (igual ao nome da pasta).
- `stages.<etapa>.status`: `pending`, `running`, `done` ou um estado de falha (abaixo). Etapas: `plan`, `tests`,
  `testReview`, `implement`, `review`. `testReview` e `review` guardam também o `verdict` do reviewer.
- `tests`: caminhos, relativos à raiz do repositório, dos arquivos de teste da feature. É a lista que os gates usam.
- `scenarios`: ligação cenário `C<n>` → critério `A<n>` → nome do teste.
- `testShas`: sha do blob (`git hash-object`) de cada teste, gravado por `pnpm gate tests-reviewed <feature> --sign`
  depois da aprovação do reviewer. Se um sha mudar, a revisão cai.
- `gates.<nome>`: último resultado de cada gate (`PASS`/`FAIL`, horário ISO e detalhe), gravado pelo script.

## Status das etapas
| Status | Significado | O que fazer |
|---|---|---|
| `needs_input` | o subagente ou o plano pediu decisão humana | responder e retomar a etapa |
| `failed` | o reviewer reprovou ou o subagente não entregou | refazer a etapa com a lista de achados |
| `error` | gate FAIL (ex.: teste passou antes da hora, sha mudou, cobertura abaixo do limite, 0/0 ou teste pulado) | ler a mensagem do gate; não é sucesso |

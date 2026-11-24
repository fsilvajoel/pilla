# Revisão E12-F06 (E2E da tesouraria)

revisor: claude Opus (revisão final da E12, 23/11). Referências conferidas: plano A1 a A3, ADR-0017.

## Revisão dos testes (etapa 3): APROVADO (leitura)
- `apps/web/e2e/treasury.e2e.ts` (commit f8118aa) cobre o fluxo 1 a 6 do plano em três testes (linhas 142, 177 e 192):
  aporte, ajuste e retirada com sinais e saldo após, recusas do diálogo, aviso RN-C10 na ativação, desembolso,
  recebimento e estorno chegando ao caixa.
- A2: sem espera fixa; esperas por nova leitura da tela (`page.goto` e `expect` com tempo limite). O
  `test.setTimeout(480_000)` da linha 7 é limite do teste, não espera.
- A3: dados próprios com nome único (`e2e-${Date.now()}`, linha 146).
- A1 "sem erro no console": há coleta de `page.on("console")` (linha 14).

## Revisão final (etapa 6): NÃO CONCLUÍDA
O critério A1 é "o fluxo passa com a pilha real" e não há registro de execução verde: `stages.implement` está pendente
e `e2e: []` no `estado.json`. Nesta revisão o E2E não foi rodado, porque o Playwright sobe API e web nas portas fixas
3100 e 3101 e um pre-push com e2e estava em andamento em outra cópia do repositório. Sem execução, nem aprovação nem
reprovação. Próximo passo: rodar `pnpm --filter @pilla/web e2e -- treasury.e2e.ts` com a pilha livre, registrar o
resultado e o arquivo em `e2e` do `estado.json`, e fechar esta revisão.

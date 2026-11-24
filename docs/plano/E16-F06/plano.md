# E16-F06: E2E da importação

Plano da feature. Cartão: E16-T11 (sonnet). Referências: PRD-001 RF-70 e RN-P01, `docs/plano/E16.md`.

## Escopo

`apps/web/e2e/imports.e2e.ts` (Playwright contra a API real, compose com migração e seed), arquivo CSV **fictício** criado pelo teste com nomes únicos por execução:
- upload em `/importacao` com linhas consistente, a revisar, rejeitada e com CPF em branco; conferir totais e a tabela "a revisar" com os motivos;
- abrir um contrato listado: está `ACTIVE`, mostra o pagamento importado e, na linha a revisar, o tipo Personalizado; abrir a pessoa sem CPF e ver CPF pendente;
- em `/caixa`, conferir o DISBURSEMENT e o REPAYMENT com datas históricas depois do despachante (reler a tela com `expect` e timeout, nunca `waitForTimeout`);
- reenviar o mesmo arquivo e ver a mensagem de já importado.

Fora: importar arquivo grande; teste de desempenho.

## Critérios de aceite

- A1: o fluxo acima passa com `pnpm --filter @pilla/web e2e`.
- A2: sem erro de console; dados criados pelo próprio teste.
- A3: nenhum dado real, nenhum `waitForTimeout`.

## Riscos

Saldo atrasado em até ~2 s (poller, E12 D2): reler a tela.

## Dependências

F05 e E12 (ledger) para a conferência do caixa.

# E11-F06: E2E do ciclo de pagamentos

Plano da feature. Cartão: E11-T10 (claude Sonnet). Referências: PRD-001 RF-20 a RF-23, RN-C09 e RN-R10, `docs/plano/E11.md`. O arquivo é `apps/web/e2e/payments.e2e.ts`, porque o Playwright usa `testMatch **/*.e2e.ts`; segue os auxiliares de `loans.e2e.ts` (criar DRAFT, ativar, observar o console).

## Escopo

Entra, contra a API e o Postgres reais (compose, migrate e seed), com contratos criados pelo próprio teste:
- registrar, conferir e confirmar:
  - criar e ativar um contrato de 6 parcelas;
  - em `/emprestimos/{id}/pagamento`, ver a prévia, registrar o valor da 1ª parcela;
  - ver o pagamento pendente em `/pagamentos`, confirmar e ver a 1ª parcela paga e o saldo menor no detalhe;
- estornar: estornar com motivo e ver parcela e saldo de volta;
- quitar:
  - pagar o valor da cotação de quitação e confirmar: contrato "Quitado";
  - estornar esse pagamento: contrato "Ativo" de novo (RN-R10);
- valor acima do saldo: mensagem em pt-BR e nada registrado;
- DRAFT: registrar pagamento num rascunho; a confirmação é recusada com a mensagem; ativar o contrato e confirmar.

Fora:
- Renovação bem-sucedida e baixa seguida de recuperação (as cobertas pelos testes de API);
- RN-R11 (coberta na API);
- comprovante (v1.1).

## Critérios de aceite
- `pnpm --filter @pilla/web e2e` passa.
- Não há erro no console.
- Cada teste cria os próprios contratos e não depende de contagem global.

## Dependências
- F05; seed com pessoas e a conta base.

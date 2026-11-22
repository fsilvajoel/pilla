# E12-F06: E2E da tesouraria

Plano da feature. Cartão: E12-T10 (claude Sonnet). Referências: PRD-001 RF-30 a RF-32, RN-T01 a RN-T03 e RN-C10, ADR-0017, `docs/plano/E12.md` D2 e D6, `docs/plano/E12-F05/plano.md`, `docs/plano/E11-F06/plano.md` (mesmo ambiente).

## Escopo

Entra: `apps/web/e2e/treasury.e2e.ts` (novo), Playwright contra a API real (compose, migrações e seed, como
`payments.e2e.ts`), com o poller do outbox ligado. Toda espera por efeito de evento é por nova leitura da tela
(`expect(...).toHaveText` com tempo limite ou recarregar), nunca `waitForTimeout`.

Fluxo:
1. abrir `/caixa`, lançar um aporte e ver o saldo e a linha no extrato;
2. lançar um ajuste negativo com justificativa e uma retirada; ver os sinais e o saldo após;
3. criar um contrato com principal maior que o caixa, abrir "Ativar", ver o aviso RN-C10 e ativar mesmo assim;
4. voltar a `/caixa` e ver o DISBURSEMENT negativo, o saldo negativo e o "emprestado" no painel;
5. registrar e confirmar um pagamento; ver em `/caixa` os recebimentos por componente e os juros do mês;
6. estornar o pagamento e ver os REVERSAL e o saldo de volta.

Fora: baixa e recuperação (cobertas pelos testes HTTP da F04); mudança de mês.

## Critérios de aceite

- A1: o fluxo de 1 a 6 passa com a pilha real e sem erro no console.
- A2: o arquivo não usa espera fixa.
- A3: o teste cria os próprios dados (nomes únicos) e não depende da ordem dos outros E2E.

## Dependências

E12-T09; E11-T09 (telas de pagamento); E10-T16 (telas de contrato).

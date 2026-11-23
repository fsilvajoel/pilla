# E15-F07A: E2E do portal do cliente

Plano da feature. Cartão: E15-T12 (Sonnet). Referências: PRD-001 RF-61 a RF-64, CA-09, CA-09b, ADR-0017,
`docs/plano/E15.md` D3, D4, D10, D15, `docs/plano/E12-F06/plano.md` (padrão de E2E).

## Escopo

Entra: `apps/web/e2e/portal.e2e.ts` (novo), Playwright contra a API real (compose, migrações e seed). Sem espera fixa
(`waitForTimeout`). O teste cria os próprios dados (nomes e CPFs únicos válidos) e **semeia o acesso direto no banco**
(uma linha em `access.admin_users` para satisfazer `enabled_by` e uma em `access.portal_access`), para não depender da
E14. Dois clientes (A e B), cada um com contrato ativo; A com uma parcela atrasada e um pagamento confirmado; B para
provar o isolamento.

Fluxo:
1. `/portal`: CPF de A (digitado com pontos e traço) entra; ver a lista com o contrato de A, "Em atraso", e nenhum de B;
2. abrir o detalhe: próxima parcela, aviso de encargos, parcelas, pagamento recebido, em português simples (texto
   exato da F05A/F05B);
3. abrir pela URL o `id` do contrato de B logado como A: "Não encontramos este contrato.";
4. "Sair": volta a `/portal`; voltar pelo histórico a `/portal/contratos` exige entrar de novo;
5. CPF inexistente e CPF de pessoa sem acesso mostram a **mesma** frase de erro;
6. CA-09b: 30 CPFs diferentes passam e o 31º mostra a frase de "Muitas tentativas" (feito pela API para ser rápido,
   com um IP próprio do teste via cabeçalho que o deploy de teste confia; se não houver como fixar IP no E2E, essa etapa
   fica só nos testes HTTP da F02 e o E2E registra o motivo).

## Critérios de aceite

- A1: o fluxo de 1 a 5 passa com a pilha real e sem erro no console.
- A2: o arquivo não usa espera fixa e cria os próprios dados.
- A3: nenhum CPF em texto aparece no HTML nem na URL de nenhuma página do portal.
- A4: o E2E não depende da E14.

## Dependências

F05B, E10-T18 (infra do E2E). Destrava o fechamento da E15 (sem a parte do ADMIN).

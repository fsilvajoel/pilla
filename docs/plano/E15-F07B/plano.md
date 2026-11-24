# E15-F07B: E2E do ADMIN habilitando e desabilitando (depende da E14)

Plano da feature. Cartão: E15-T13 (Haiku). Referências: PRD-001 RF-60, `docs/plano/E15.md` D13,
`docs/plano/E15-F06/plano.md`, `docs/plano/E15-F07A/plano.md`.

**Dependência explícita da E14:** o teste faz login de ADMIN.

## Escopo

Entra: `apps/web/e2e/portal-access.e2e.ts` (novo). Fluxo: entra como ADMIN (helper de login da E14); cria uma pessoa com
CPF; em outra aba, `/portal` com esse CPF é recusado; na ficha liga "Acesso ao portal"; o CPF entra e vê a lista (vazia);
desliga na ficha; a sessão aberta do cliente cai na próxima ação ("Por segurança, entre de novo com o seu CPF.") e um
novo login é recusado. Confere que a auditoria tem as duas ações (leitura pela API do ADMIN da E14 ou consulta ao
banco do teste).

## Critérios de aceite

- A1: o fluxo passa com a pilha real e sem erro no console; sem espera fixa; dados próprios.
- A2: pessoa sem CPF mostra a chave desabilitada com "Cadastre o CPF para liberar o acesso.".

## Dependências

F06, F07A, **E14**.

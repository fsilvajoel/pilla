# E15-F03: ADMIN habilita e desabilita o acesso ao portal (depende da E14)

Plano da feature. Cartões: E15-T05 (testes, Sonnet) e E15-T06 (implementação, Sonnet). Referências: PRD-001 RF-60,
RN-A03, ADR-0006, ADR-0007, RFC-004 §3, RFC-005 §2 e §7, `docs/plano/E15.md` D13, `docs/plano/pendencias-pm.md`
(E15-T05).

**Dependência explícita da E14:** o endpoint é só ADMIN. Precisa do guarda de ADMIN da E14 e do `adminUserId` da sessão.
Enquanto a E14 não fechar, esta feature não começa. É a única feature de API da E15 que espera a E14.

## Escopo

Entra:
- `PUT /api/v1/portal-access/{personId}` `{enabled}` e `GET /api/v1/portal-access/{personId}`, respostas
  `portalAccessResponse` (F01); controller `apps/api/src/access/http/portal-access.controller.ts`, serviço
  `access/application/portal-access-service.ts`.
- Regras da D13: pessoa existe (`people/public` `personExists`; 404); habilitar exige CPF (422 `PERSON_WITHOUT_CPF`,
  leitura nova em `people/public`: `personHasCpf`); upsert em `portal_access`; auditoria na mesma transação
  (`recordAudit`); ao desabilitar apaga `sessions` CLIENT da pessoa; repetir o estado é idempotente (200, sem auditoria
  nova).
- Mensagem pt-BR do novo código no arquivo de mensagens e a linha na tabela da RFC-004 §6 (se o PM aprovar).

Fora: lista de pessoas com acesso; histórico na tela; avisar o cliente.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `personId` (caminho) | uuid | - | - | não uuid | 400 | RFC-004 |
| `enabled` | boolean | - | - | string, ausente, campo extra | 400 | F01 |
| pessoa | existente | - | - | inexistente | 404 `NOT_FOUND` | D13 |
| pessoa a habilitar | com CPF | - | - | `cpf` nulo | 422 `PERSON_WITHOUT_CPF` | D13 |
| sessão | ADMIN válida | - | - | sem sessão / papel CLIENT | 401 / 403 | E14, ADR-0007 |

## Critérios de aceite

- A1: habilitar pessoa com CPF cria a linha (`enabled`, `enabled_at` agora, `enabled_by` o admin) e uma entrada de
  auditoria `PORTAL_ACCESS_ENABLED` com `before` nulo e `after` `{enabled: true}`; resposta 200.
- A2: desabilitar muda `enabled` para false, mantém `enabled_at` e `enabled_by`, `version + 1`, grava
  `PORTAL_ACCESS_DISABLED` e apaga as sessões CLIENT da pessoa (as de outras pessoas ficam).
- A3: repetir o estado atual responde 200 e não grava auditoria nem muda `version`.
- A4: pessoa inexistente 404; sem CPF e `enabled: true` 422 `PERSON_WITHOUT_CPF` sem gravar nada; `enabled: false` em
  pessoa sem CPF e sem linha responde 200 sem criar linha.
- A5: auditoria e linha na mesma transação (falha da auditoria desfaz o upsert).
- A6: sem sessão de ADMIN 401; com sessão de CLIENTE do portal 403; a resposta nunca traz o CPF.
- A7: `GET` devolve o estado (`enabled: false` e `enabledAt: null` para quem nunca teve linha).
- A8: depois de desabilitar, o guarda do portal (F02) devolve 401 para a pessoa (teste de integração com a F02).

## Casos de teste

`apps/api/src/access/http/portal-access.http.test.ts` (PGlite, guarda de ADMIN da E14 ou o fake de teste que ela
oferecer): C1..C3 habilitar, desabilitar, idempotência; C4..C6 erros; C7 transação; C8 papel; C9 `GET`; C10 integração
com o guarda.

## Riscos

- A forma do guarda da E14 pode diferir: muda só o T06 (D13 aqui diz o que precisa: `adminUserId` e o IP).

## Dependências

F01; **E14**; F02 só para a C10. Destrava F06.

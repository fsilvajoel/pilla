# E10-F12: tela de edição do contrato em rascunho

Plano da feature. Cartão: E10-T21 (claude), cartão de tela. Referências: PRD-001 RF-11 e RF-17, RN-C06 (só o DRAFT é editável), RFC-004 §3 e §6, `docs/plano/E10.md` D9 e D12. Sem teste de tela nesta fase (emenda de 19/11 à ADR-0017); a lógica pura da tela pode ter teste.

## Escopo

Entra:
- Rota `/emprestimos/[id]/editar`: formulário com os campos editáveis do DRAFT, preenchido com o contrato; envia `PATCH /loans/{id}` com `If-Match: <loan.version>` (versão da F11) e volta ao detalhe.
- Link "Editar" no detalhe só em DRAFT; fora de DRAFT a rota redireciona para o detalhe.
- Erros da API (409 `VERSION_CONFLICT`, 409 `LOAN_NOT_EDITABLE`, 422) em pt-BR por `toLoanActionError`.

Fora: trocar a pessoa do contrato (o `updateLoanRequest` não aceita `personId`; ver `E10-pendencias-pm.md`, item 2), editar contrato ativo (RN-C06), nova API.

## Critérios de aceite
- A1: o formulário abre preenchido com os valores atuais do DRAFT.
- A2: salvar envia só os campos de `updateLoanRequest` com a versão em `If-Match` e leva ao detalhe com os valores novos.
- A3: o link Editar aparece só em DRAFT.
- A4: a rota redireciona ao detalhe se o contrato não for DRAFT.
- A5: erros da API aparecem em pt-BR, sem perder o que foi digitado.
- A6: a conversão do formulário para o corpo do PATCH (reais para centavos, taxa em bps) é função pura com teste (`edit-loan.test.ts`).

## Cenários
- C1 (A6): conversão de valores do formulário em `updateLoanRequest`, com casos de borda (zero, vírgula decimal).
- C2 a C5 (A1 a A5): conferência visual no navegador e pelo E2E da F10.

## Contrato

Usa `PATCH /loans/{id}` e `updateLoanRequest` já existentes (F03); `GET /loans/{id}` com `version` (F11). Código novo só em `apps/web` (`app/(admin)/emprestimos/[id]/editar`, `components/loans`, `lib/api/loans.ts`, `actions.ts`).

## Dependências

F11. Entra no E2E da F10.

## Riscos
- Edição concorrente em duas abas: a segunda recebe 409 e deve recarregar.
- Campos copiados do padrão (encargos) editados sem aviso de que só afetam este contrato (RN-C12).

# E7-F01: cadastro de pessoa e data de hoje em Brasília

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-01 e RF-03;
RFC-005 (tabela `persons`); ADR-0013; decisões do Joel de 17/11 (`docs/plano/decisoes-2026-11-17.md`).

## Escopo

- E7-T01 (Bia): `apps/web/lib/today.test.ts` e `apps/web/components/person-form.test.tsx`.
- E7-T02 (Alice): `apps/web/lib/today.ts`, `todayInBrt(now)` → `IsoDate` do dia em America/Sao_Paulo. Usado pela
  página `/emprestimos/simular` como data do desembolso.
- E7-T03 (Alice): `apps/web/components/person-form.tsx`, tela "Cadastrar pessoa" (rota `/pessoas/nova`) com
  React Hook Form e `createPersonRequest` de `@pilla/schemas`.
- Fora: API de verdade (o `onSubmit` só recebe o corpo), lista e edição de pessoas, RF-02 e RF-04, máscara de
  CPF e telefone.

## Riscos

- Fuso: `new Date()` em UTC vira o dia seguinte depois das 21h em Brasília; o teste fixa 2026-11-18T02:30:00Z.
- Opcionais vazios enviados como "" quebram o esquema (`email` e `birthDate` têm formato); o teste exige o corpo
  só com os 3 campos obrigatórios.
- Submit assíncrono do React Hook Form: o teste espera o status/alerta com `findByRole`.

## Dependências

- `createPersonRequest`, `PersonSummary` e `phoneSchema` (E.164) de `@pilla/schemas`, no commit de preparo.
- `isoDate` de `@pilla/finance` (E1); `mockPeople` de `apps/web/lib/mock-data.ts`.

## Critérios de aceite

- A1: `todayInBrt` dá "2026-11-17" para 2026-11-18T02:30:00Z e para 2026-11-17T15:00:00Z.
- A2: o formulário tem os 7 rótulos e o botão "Cadastrar"; Maria da Silva, CPF 52998224725 e telefone
  +5511987654321 viram exatamente `{fullName, cpf, phone}` e o status "Pessoa cadastrada.".
- A3: "Indicado por" João Pereira manda `referredById` com o id dele (RF-03).
- A4: telefone sem +55 mostra "Confira os campos do cadastro." e não chama `onSubmit`.
- A5: 100% de linhas e ramos de `today.ts`, 85% de `person-form.tsx`; typecheck e lint verdes.

## Cenários

- C1: `todayInBrt` antes e depois da meia-noite UTC.
- C2: rótulos e botão do cadastro.
- C3: cadastro só com os campos obrigatórios.
- C4: cadastro com indicação.
- C5: telefone fora do E.164.

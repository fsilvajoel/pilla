# Plano E7-F01: cadastro de pessoa e data de hoje em Brasília

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-01, RF-03,
RN-P01 e RN-P02; RFC-005 (tabela `persons`); ADR-0013; decisões do Joel de 17/11
(`docs/plano/decisoes-2026-11-17.md`).

## Escopo

- E7-T01 (Bia): `apps/web/lib/today.test.ts` e `apps/web/components/person-form.test.tsx`.
- E7-T02 (Alice): `apps/web/lib/today.ts`, `todayInBrt(now)` → `IsoDate` do dia em Brasília (UTC−3 fixo, sem horário de verão)
  fixo). Usado pela página `/emprestimos/simular` como data do desembolso.
- E7-T03 (Alice): `apps/web/components/person-form.tsx`, tela "Cadastrar pessoa" (rota `/pessoas/nova`) com
  React Hook Form e `createPersonRequest` de `@pilla/schemas`.
- Fora: API de verdade (o `onSubmit` só recebe o corpo), lista e edição de pessoas, RF-02 e RF-04, máscara de
  CPF e telefone.

Cartões: `docs/plano/E7.yaml` (E7-T01, E7-T02, E7-T03)

## Contrato

- `apps/web/lib/today.ts`: `todayInBrt(now: Date): IsoDate` (`IsoDate` de `@pilla/finance`, texto com marca:
  `toBe("2026-11-17")` funciona sem importar tipo; a implementação usa só `isoDate` de `@pilla/finance` como valor).
- `apps/web/components/person-form.tsx`: `PersonForm` com props `people: readonly PersonSummary[]` e
  `onSubmit?: (request: CreatePersonRequest) => void` (`import type` de `@pilla/schemas`, só na implementação).
  O campo "Nascimento" é texto (`<input type="text">`, validado por `isoDateSchema`), nunca `type="date"`: no jsdom
  o `type="date"` zera valor inválido para `""` e o C9 passaria sem alerta; o campo precisa preservar o texto digitado.
  O teste passa `mockPeople` (`@/lib/mock-data`) e um `vi.fn()`; não importa tipo.
- `CreatePersonRequest` é inferido do Zod: `{ fullName, cpf, phone }` mais os opcionais `email`, `birthDate`,
  `referredById`, `notes`, que ficam de fora quando vazios. Esperado no teste:
  `{ fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321" }` e, na indicação, o mesmo com
  `referredById: "01936f8e-7b2c-7cde-8f00-000000000003"` (João Pereira em `mockPeople`).
- `verbatimModuleSyntax` e `noUnusedLocals` estão ligados: tipo só entra com `import type`, e nada é importado sem
  uso. As linhas de import exatas de cada arquivo de teste estão no `done` do cartão (lista fechada); o `vi` vem
  numa linha própria (`import { vi } from "vitest";`) por causa do validador de cartões.

## Arquivos de produção
Viram `sources` no estado; os marcados como domínio viram `domainSources` (gate de mutação).

| Arquivo | Domínio |
|---|---|
| `apps/web/lib/today.ts` | sim |
| `apps/web/components/person-form.tsx` | não |

Justificativa: `today.ts` é cálculo puro (instante UTC → dia civil em UTC−3), logo domínio, com camadas `mut` e
`prop`. `person-form.tsx` é só tela: coleta campos e delega a validação ao `createPersonRequest` já existente em
`@pilla/schemas` (a regra de negócio mora lá, fora desta feature); por isso não é domínio e não entra em
`domainSources`.

## Domínio das entradas

| Entrada | Formato aceito | Mínimo | Máximo | Exemplos rejeitados | Erro esperado | Fonte |
|---|---|---|---|---|---|---|
| `now` (Date, `todayInBrt`) | `Date` com instante válido | qualquer instante válido (sem limite próprio) | qualquer instante válido | `new Date("x")` (Invalid Date) | lança `RangeError` (data inválida; `toISOString` do JS rejeita) | decisões 17/11 (fuso Brasília); regra de "inválido" é do JS, não do negócio |
| `fullName` | texto; após trim, 1 a 150 caracteres | 1 (após trim) | 150 | `""`, `"   "`, 151 caracteres | `ZodError` em `fullName`; tela mostra "Confira os campos do cadastro." e não chama `onSubmit` | `create-person.ts` (`trim().min(1).max(150)`); decisões 17/11 (nome 150); RF-01 |
| `cpf` | 11 dígitos, sem máscara, dígitos verificadores válidos, não todos iguais | 11 dígitos | 11 dígitos | `""`, `"5299822472"` (10), `"529982247250"` (12), `"529.982.247-25"`, `"52998224726"` (DV errado), `"11111111111"`, `"5299822472a"` | `ZodError` em `cpf` ("invalid CPF check digits" para DV; regex para formato); alerta "Confira os campos do cadastro." | `common.ts` `cpfSchema`; RFC-005 `persons.cpf char(11)`; RN-P01 |
| `phone` | E.164: `+`, dígito 1-9, depois 7 a 14 dígitos (8 a 15 no total) | `+` + 8 dígitos | `+` + 15 dígitos | `""`, `"11987654321"` (sem +), `"5511987654321"`, `"+0511987654321"`, `"+1234567"` (curto), `"+1234567890123456"` (longo), `" +5511987654321 "`, `"+55 11 98765-4321"` | `ZodError` em `phone`; alerta "Confira os campos do cadastro." | `common.ts` `phoneSchema` (`/^[+][1-9][0-9]{7,14}$/`); RFC-005 `persons.phone` E.164 |
| `email` (opcional) | e-mail válido do Zod, até 254 caracteres; vazio = omitido | omitido ou e-mail válido | 254 caracteres | `"maria"`, `"maria@"`, `"@x.com"`, `"a b@x.com"`, 255 caracteres | `ZodError` em `email`; alerta "Confira os campos do cadastro." | `create-person.ts` (`z.email().max(254)`); decisões 17/11 (e-mail 254); RF-01 |
| `birthDate` (opcional) | `YYYY-MM-DD` válido no calendário; vazio = omitido | omitido ou data de calendário válida | sem limite próprio no schema | `"2026-13-01"`, `"2026-02-30"`, `"17/11/1990"`, `"1990-1-1"`, `"abc"` | `ZodError` em `birthDate`; alerta "Confira os campos do cadastro." | `common.ts` `isoDateSchema` (`z.iso.date()`); RFC-005 `persons.birth_date date`; RF-01 |
| `referredById` (opcional) | id da pessoa escolhida no select "Indicado por" (UUID v7 de `people`); vazio = omitido | omitido ou 1 id | 1 id | `""` enviado no corpo, `"abc"`, UUID v4 | `ZodError` em `referredById` se o id não for UUID v7; o select só oferece ids de `people`. **Exceção aprovada pelo plano, sem cenário de teste:** a rejeição não é alcançável pela tela (o select é alimentado pela lista de pessoas já validada e não aceita texto livre); a regra fica coberta pelo `idSchema` em `@pilla/schemas` | `common.ts` `idSchema` (`z.uuidv7()`); RF-03; RN-P02; RFC-005 `persons.referred_by_id` |
| `notes` (opcional) | texto; após trim, 1 a 2000 caracteres; vazio = omitido | 1 (após trim) | 2000 | `"   "` (só espaços, quando preenchido), 2001 caracteres | `ZodError` em `notes`; alerta "Confira os campos do cadastro." | `create-person.ts` (`trim().min(1).max(2000)`); decisões 17/11 (observações 2000); RF-01 |

Nota sobre campos opcionais vazios: a tela remove do corpo o campo vazio (`""` vira omitido),
senão `email` e `birthDate` quebrariam o esquema. A rejeição de `notes` só espaços vale para o schema;
o caso é coberto pelo C12.

## Riscos
- Fuso: `new Date()` em UTC vira o dia seguinte depois das 21h em Brasília; o teste fixa 2026-11-18T02:30:00Z
  (C1, C2).
- Opcionais vazios enviados como "" quebram o esquema (`email` e `birthDate` têm formato); o teste exige o corpo
  só com os 3 campos obrigatórios (C4).
- Submit assíncrono do React Hook Form: o teste espera o status/alerta com `findByRole` (C4 a C10).

## Dependências
- `createPersonRequest`, `PersonSummary`, `cpfSchema`, `phoneSchema` (E.164) e `isoDateSchema` de
  `@pilla/schemas`, no commit de preparo.
- `isoDate` de `@pilla/finance` (E1); `mockPeople` de `apps/web/lib/mock-data.ts`.

## Critérios de aceite

### A1: data de hoje em Brasília
- entrada: `now: Date` (instante UTC)
- domínio: `now` (Date válido)
- saída: `IsoDate` "YYYY-MM-DD" do dia civil em UTC−3; "2026-11-17" para 2026-11-18T02:30:00Z e para
  2026-11-17T15:00:00Z
- erro: Date inválido lança `RangeError`
- fonte: decisões 17/11 (data de desembolso = hoje em Brasília, exemplos de referência)
- camada: unit, prop, mut

### A2: cadastro só com campos obrigatórios
- entrada: formulário com nome "Maria da Silva", CPF "52998224725", telefone "+5511987654321"; opcionais vazios
- domínio: `fullName`, `cpf`, `phone` válidos; `email`, `birthDate`, `referredById`, `notes` vazios
- saída: o formulário tem os 7 rótulos ("Nome completo", "CPF", "Telefone", "E-mail", "Nascimento",
  "Indicado por", "Observações") e o botão "Cadastrar"; `onSubmit` recebe exatamente
  `{ fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321" }` e a tela mostra o status
  "Pessoa cadastrada."
- erro: nenhum
- fonte: RF-01; RFC-005 `persons`; `create-person.ts`
- camada: unit

### A3: cadastro com indicação
- entrada: A2 mais "Indicado por" = João Pereira (id `01936f8e-7b2c-7cde-8f00-000000000003`)
- domínio: `referredById` entre os ids de `mockPeople`
- saída: `onSubmit` recebe `{ fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321",
  referredById: "01936f8e-7b2c-7cde-8f00-000000000003" }`
- erro: nenhum
- fonte: RF-03; RN-P02
- camada: unit

### A4: rejeição de campo fora do domínio
- entrada: um campo por vez fora do domínio (telefone sem +55/E.164, CPF com DV errado, e-mail sem domínio,
  nascimento "2026-13-01", nome vazio, observações só com espaços) com os demais válidos; e `now` inválido em `todayInBrt`
- domínio: `phone` aceita apenas `+` seguido de 1-9 e 7 a 14 dígitos; `cpf` aceita 11 dígitos sem máscara,
  dígitos verificadores válidos e não repetidos; `email` aceita e-mail válido do Zod com máximo 254;
  `birthDate` aceita data válida `YYYY-MM-DD`; `fullName` aceita texto aparado de 1 a 150 caracteres; `notes` aceita texto aparado de 1 a 2000 caracteres;
  `now` aceita somente `Date` com instante válido
- saída: `onSubmit` não é chamado
- erro: a tela mostra o alerta "Confira os campos do cadastro."; `todayInBrt(new Date("x"))` lança
  `RangeError` (tipo exato)
- fonte: `create-person.ts`, `common.ts` (`cpfSchema`, `phoneSchema`, `isoDateSchema`); RN-P01; RFC-005
- camada: unit

Nota: cobertura (100% de linhas e ramos de `today.ts`, 85% de `person-form.tsx`), typecheck e lint não são
critérios `A<n>`; já são cobrados pelos gates.

## Cenários
- C1 (A1, unit): `todayInBrt(new Date("2026-11-18T02:30:00Z"))` → "2026-11-17" (fonte decisões 17/11)
- C2 (A1, unit): `todayInBrt(new Date("2026-11-17T15:00:00Z"))` → "2026-11-17" (fonte decisões 17/11)
- C3 (A1, prop): para todo instante válido, o resultado tem formato `YYYY-MM-DD` e é igual ao dia de
  `now − 3h` em UTC (fonte decisões 17/11, UTC−3 fixo)
- C4 (A2, unit): rótulos e botão presentes; Maria da Silva, CPF 52998224725, telefone +5511987654321 →
  `onSubmit` com `{fullName:"Maria da Silva", cpf:"52998224725", phone:"+5511987654321"}` e status
  "Pessoa cadastrada." (fonte RF-01)
- C5 (A3, unit): C4 com "Indicado por" João Pereira → `onSubmit` com o mesmo corpo mais
  `referredById: "01936f8e-7b2c-7cde-8f00-000000000003"` (fonte RF-03)
- C6 (A4, unit): telefone "11987654321" (sem +55) → alerta "Confira os campos do cadastro." e `onSubmit` não
  chamado (fonte `phoneSchema`)
- C7 (A4, unit): CPF "52998224726" (DV errado) → alerta e `onSubmit` não chamado (fonte `cpfSchema`, RN-P01)
- C8 (A4, unit): e-mail "maria@" → alerta e `onSubmit` não chamado (fonte `create-person.ts`)
- C9 (A4, unit): nascimento "2026-13-01" → alerta e `onSubmit` não chamado (fonte `isoDateSchema`)
- C10 (A4, unit): nome vazio → alerta e `onSubmit` não chamado (fonte `create-person.ts`, `min(1)`)
- C11 (A4, unit): `todayInBrt(new Date("x"))` → lança `RangeError` (data inválida)
- C12 (A4, unit): observações só com espaços → alerta "Confira os campos do cadastro." e `onSubmit` não chamado
- C13 (A1, unit): `2026-11-18T02:59:59.999Z` → `2026-11-17`; `2026-11-18T03:00:00.000Z` → `2026-11-18` (fronteira do UTC−3 fixo; fonte decisões 17/11)
  (fonte `create-person.ts`, `trim().min(1)`)

Como o teste consulta a tela: rótulos por `getByLabelText` (texto inteiro) e botão
`getByRole("button", { name: "Cadastrar" })`; preencher com `fireEvent.change(..., { target: { value } })`; no
select "Indicado por" o value é o id da pessoa. Sucesso: `await screen.findByRole("status")`; erro:
`await screen.findByRole("alert")`; guardar o elemento e conferir com `toHaveTextContent`, depois as
conferências do `onSubmit` (nunca `await expect(findBy...)`). Só `fireEvent` de `@testing-library/react` (sem
`userEvent`); modelo `apps/web/app/page.test.tsx`; um `render` por teste.

## Arquivos de teste previstos
- `apps/web/lib/today.test.ts` (pacote `web`; camadas unit, prop): `pnpm --filter web exec vitest run lib/today.test.ts`
- `apps/web/components/person-form.test.tsx` (pacote `web`; camada unit):
  `pnpm --filter web exec vitest run components/person-form.test.tsx`
- e2e: nenhum (sem critério e2e; a rota `/pessoas/nova` não tem fluxo e2e nesta feature)

## Ressalvas
- `now` inválido (`RangeError`): sem fonte documental independente; o "inválido" é regra do JS (`toISOString`), não de negócio.
  Ressalva do revisor, não vira valor de implementação.
- `referredById`: sem rejeição pela tela (exceção aprovada na tabela de domínio).

## Pendências
- nenhuma

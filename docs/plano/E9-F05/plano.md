# Plano E9-F05: ficha agregada da pessoa

Plano da feature para E9-T09 e E9-T10 (`docs/plano/E9.yaml`). Referências: PRD-001 RF-03/RF-04, RFC-004 §§2, 3 e 6, RFC-005 §3, contrato `personDetailResponse`, decisões D1/D3/D7 e planos E9-F03/E9-F04.

## Escopo

- Substituir a resposta básica de `GET /api/v1/people/{id}` pela `personDetailResponse`.
- Agregar pessoa, indicador, indicados, endereços e chaves PIX em uma única resposta.
- Ordenar endereços e PIX com principal primeiro.
- Usar no máximo quatro consultas por ficha, sem N+1.
- Preservar pessoas inativas na resposta, com `active: false`.
- Omitir `email`, `birthDate` e `notes` quando nulos ou ausentes.
- Não incluir `contracts` na resposta.

Fora: contratos e pagamentos, autenticação/guard, portal do cliente, front-end e E2E Playwright.

## Contrato

Base `/api/v1`; JSON validado na borda HTTP por Zod e erros em `application/problem+json` (D1, RFC-004 §2).

### Assinatura

```text
GET /api/v1/people/{id}
```

Parâmetro:

- `id`: UUID v7 da pessoa.

Respostas:

- `200 application/json`: `PersonDetailResponse`.
- `400 application/problem+json`: UUID v7 malformado ou não v7.
- `404 application/problem+json`: pessoa inexistente.

### Forma exata da saída

```ts
{
  id: string;
  fullName: string;
  cpf: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  active: boolean;
  version: number;
  referrer: PersonSummary | null;
  referrals: PersonSummary[];
  addresses: Address[];
  pixKeys: PixKey[];
}
```

`PersonSummary`:

```ts
{
  id: string;
  fullName: string;
  cpf: string | null;
  phone: string;
  active: boolean;
}
```

Os CPFs nulos são permitidos apenas nos resumos de indicador e indicados, pois podem representar pessoas importadas sem CPF. Ajustar `personSummarySchema.cpf` para `cpfSchema.nullable()`; este ajuste já é exigido pela E9-F03 e pela infraestrutura E5-F05. A pessoa principal continua validada pelo campo `cpf: cpfSchema` de `personDetailResponse`.

### Ordem

- Endereços: `isPrimary desc`, `createdAt asc`, `id asc`.
- PIX: `isPrimary desc`, `createdAt asc`, `id asc`.
- Indicados: `lower(full_name) asc`, `id asc`.

O desempate de endereços e PIX usa criação seguida do ID. O plano opta por `createdAt asc, id asc` porque `created_at` existe nas tabelas e o UUID v7 ainda permite desempate determinístico.

### Erros exatos

404:

```json
{
  "title": "Não encontrado",
  "status": 404,
  "detail": "Recurso não encontrado.",
  "code": "NOT_FOUND"
}
```

400 para ID malformado ou UUID não v7:

```json
{
  "title": "Validação falhou",
  "status": 400,
  "detail": "Dados inválidos.",
  "code": "VALIDATION_FAILED"
}
```

## Arquivos de produção

| Arquivo | Domínio | Motivo |
|---|---:|---|
| `apps/api/src/people/infra/person-repository.ts` | Não | Consultar pessoa e indicador, indicados, endereços e PIX em consultas agregadas sem N+1; pode existir repositório novo da ficha sem colidir com os testes existentes. |
| `apps/api/src/people/application/get-person-sheet.ts` | Não | Orquestrar a leitura agregada e montar `PersonDetailResponse`; arquivo novo permitido pelo plano. |
| `apps/api/src/people/http/people.controller.ts` | Não | Validar `id`, substituir a resposta básica de GET por id pela ficha e traduzir 404/400; pode ser controller próprio se a F03 já criou o GET básico nele. |
| `apps/api/src/people/people.module.ts` | Não | Compor repositório, caso de uso e controller da ficha já presentes ou criados pela feature. |

Nenhum arquivo de teste pertence à tabela de produção. A camada de domínio não recebe arquivo novo; montagem da resposta é orquestração de aplicação e persistência.

## Domínio das entradas

| Entrada | Domínio aceito | Rejeição | Fonte |
|---|---|---|---|
| `id` | UUID v7 válido | UUID v4, texto, UUID malformado ou UUID não v7: `400 VALIDATION_FAILED` | RFC-004 §2; `idSchema` |
| pessoa inexistente | ID v7 sem linha em `people.persons` | `404 NOT_FOUND` | RFC-004 §§3 e 6 |
| pessoa inativa | Pessoa existente com `active: false` | Nenhuma rejeição; devolve ficha normalmente | Decisão explícita da tarefa |
| indicador | Linha referenciada por `referred_by_id` | Resumo nulo quando não houver indicador | RF-03; RFC-005 §3 |
| indicados | Linhas com `referred_by_id` igual ao ID consultado | Lista vazia | RF-03; E5-F05 |
| CPF do resumo | 11 dígitos válidos ou `null` | Valor não nulo fora de `cpfSchema` não passa no resumo | RFC-005 §3; decisão da tarefa |
| endereço | Linhas de `people.addresses` da pessoa | Lista vazia | RF-02; RFC-005 §3 |
| chave PIX | Linhas de `people.pix_keys` da pessoa | Lista vazia | RF-02; RFC-005 §3 |
| opcionais da pessoa | `email`, `birthDate` e `notes` não nulos | Ausentes/nulos são omitidos, nunca enviados como `null` | Contrato fornecido; RFC-004 §2 |

## Riscos

- O plano da E9-F03 entrega `PersonResponse` básico no GET por ID. Esta feature deve substituir a implementação desse mesmo endpoint.
- O cartão E9-T09 ainda menciona `contracts` como lista vazia, divergindo de D7 e do contrato fornecido. Corrigir E9-T09 em `docs/plano/E9.yaml`: remover `contracts is an empty list` e exigir a `personDetailResponse` sem `contracts`.
- O cartão E9-T09 não exige CPF nullable em `personSummarySchema`. Corrigir o cartão para declarar CPF nullable nos resumos.
- A infraestrutura anterior pode impor `UNIQUE(type, value)` em PIX, divergindo da decisão fixa de repetição de chave. E9-F04 deve ter removido essa restrição; nesta feature a query não pressupõe unicidade e pode listar valores iguais para tipos diferentes ou dentro de casos já válidos.
- Se E9-F04 criou o schema ou a migração com `UNIQUE(type, value)`, E9-T10 deve corrigi-los dentro de `apps/api/**`, sem alterar regras de produto.
- Endereços e PIX não devem receber campos de auditoria na ficha; mapear somente os campos definidos por `addressSchema` e `pixKeySchema`.
- A pessoa pode não ter PIX ou endereço, ou não ter principal; todas as listas devem permanecer vazias ou completas sem gerar erro.
- CPF nulo em pessoa principal não está previsto pelo contrato fornecido. A implementação não deve inventar string ou null: validar a resposta com `cpfSchema`; registros importados sem CPF serão cobertos pelos resumos.

## Dependências

- E9-F02: prefixo `/api/v1`, `ZodValidationPipe`, `ProblemDetailsFilter` e `ProblemException`.
- E9-F03: rota básica existente, `findPersonById` e módulo de pessoas; o cartão E9-T06 e o teste C8 do GET devem ser corrigidos nesta feature.
- E9-F04: schemas `addressSchema` e `pixKeySchema`, tabelas `addresses` e `pix_keys`, rotas de CRUD e invariantes de principal.
- E5-F02/E5-F05: pessoas, indicador, indicados e atualização da consulta de resumos.
- `@pilla/schemas`: `personDetailResponse`, `personSummarySchema`, `addressSchema`, `pixKeySchema`, `idSchema` e `problemSchema`.
- Testes HTTP: Supertest sobre PGlite migrado, com contador de consultas no driver PGlite.
- Sem dependência nova de runtime.

## Critérios de aceite

### A1: pessoa sem relacionamentos

- **entrada:** `GET /api/v1/people/01970000-0000-7000-8000-000000000001`.
- **domínio:** pessoa existente sem indicador, indicados, endereços ou PIX.
- **saída:** `200 application/json`, corpo exatamente `{ id, fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321", active: true, version: 1, referrer: null, referrals: [], addresses: [], pixKeys: [] }`, sem `email`, `birthDate`, `notes` ou `contracts`.
- **erro:** nenhum.
- **fonte:** RF-03/RF-04; RFC-004 §§2–3; RFC-005 §3; D7; contrato fixo.
- **camada:** unit.

### A2: ficha completa e ordenada

- **entrada:** Ana com indicador Carlos e indicados Bruno/Diana; dois endereços e duas chaves PIX nos dados literais abaixo.
- **domínio:** indicador agregado como resumo; indicados por nome normalizado e ID; principal primeiro em cada lista; demais itens desempatados por `createdAt` e ID.
- **saída:** `200 application/json`, body `PersonDetailResponse` exatamente:
  - pessoa: `{ "id": "01970000-0000-7000-8000-000000000001", "fullName": "Ana Costa", "cpf": "52998224725", "phone": "+5511987654321", "active": true, "version": 1 }`;
  - indicador: `{ "id": "01970000-0000-7000-8000-000000000002", "fullName": "Carlos Moraes", "cpf": "11144477735", "phone": "+5511987654302", "active": true }`;
  - indicados: Bruno `{ "id": "01970000-0000-7000-8000-000000000003", "fullName": "Bruno Lima", "cpf": "39053344705", "phone": "+5511987654303", "active": true }` e Diana `{ "id": "01970000-0000-7000-8000-000000000004", "fullName": "Diana Souza", "cpf": "12345678909", "phone": "+5511987654304", "active": true }`;
  - endereços: principal `{ "id": "01970000-0000-7000-8000-000000000010", "street": "Rua das Flores", "number": "123", "complement": "Apto 12", "district": "Centro", "city": "São Paulo", "state": "SP", "postalCode": "01001000", "isPrimary": true }` seguido de secundário `{ "id": "01970000-0000-7000-8000-000000000011", "street": "Rua do Comércio", "number": "45", "district": "Bela Vista", "city": "São Paulo", "state": "SP", "postalCode": "01310100", "isPrimary": false }`;
  - PIX: principal `{ "id": "01970000-0000-7000-8000-000000000012", "type": "PHONE", "value": "+5511987654321", "isPrimary": true }` seguido de secundário `{ "id": "01970000-0000-7000-8000-000000000013", "type": "EMAIL", "value": "ana@example.com", "isPrimary": false }`;
  - seed: endereços criados em `2026-01-01T10:00:00-03:00` e `2026-01-02T10:00:00-03:00`; PIX criadas em `2026-01-03T10:00:00-03:00` e `2026-01-04T10:00:00-03:00`.
- **erro:** nenhum.
- **fonte:** RF-02/RF-03/RF-04; RFC-005 §3; E5-F05; decisão fixa de ordenação.
- **camada:** unit.

### A3: ausência de principal

- **entrada:** pessoa com dois endereços e dois PIX, todos `isPrimary: false`.
- **domínio:** nenhuma preferência principal prevalece; desempate determina a ordem.
- **saída:** `200 application/json`; endereço 010 `"Rua das Flores", "123", "Apto 12", "Centro", "São Paulo", "SP", "01001000"` criado `2026-01-01T10:00:00-03:00`, depois endereço 011 `"Rua do Comércio", "45", "Bela Vista", "São Paulo", "SP", "01310100"` criado `2026-01-02T10:00:00-03:00`; ambos em `createdAt asc, id asc`, com `isPrimary: false`. PIX 012 `PHONE/+5511987654321` criado `2026-01-03T10:00:00-03:00`, depois PIX 013 `EMAIL/ana@example.com` criado `2026-01-04T10:00:00-03:00`; ambos em `createdAt asc, id asc`, com `isPrimary: false`.
- **erro:** nenhum.
- **fonte:** RF-02; RFC-005 §3; decisão fixa “pode não existir principal”.
- **camada:** unit.

### A4: opcionais, pessoa inativa e CPF nulo em resumo

- **entrada:** pessoa inativa `01970000-0000-7000-8000-000000000005` com `email: null`, `birthDate: null` e `notes: null`; segundo cenário com Ana ativa e indicada importada Bruno com `cpf: null`.
- **domínio:** opcionais da pessoa omitidos; status inativo preservado; pessoa inativa continua como indicador ou indicado e usa `active: false`; CPF nulo apenas no resumo de indicador/indicado.
- **saída:** `200 application/json`; primeiro corpo não contém `email`, `birthDate` ou `notes`, mantém `active: false`, `referrer: null`, `referrals: []`, `addresses: []` e `pixKeys: []`; segundo corpo contém a indicada Bruno com `{ "id": "01970000-0000-7000-8000-000000000003", "fullName": "Bruno Lima", "cpf": null, "phone": "+5511987654303", "active": true }` e a pessoa principal continua com CPF válido. Indicador/indicado inativo permanece no resumo com `active: false`.
- **erro:** nenhum.
- **fonte:** contrato fixo; RFC-005 §3; RN-P01; RFC-004 §2.
- **camada:** unit.

### A5: ID inválido e pessoa inexistente

- **entrada:** IDs `550e8400-e29b-41d4-a716-446655440000` (UUID v4), `"nao-e-uuid"` e `01970000-0000-7000-8000-000000000099` (UUID v7 inexistente).
- **domínio:** validação do parâmetro antes da consulta; inexistência após validação.
- **saída:** nenhum efeito no banco.
- **erro:** UUID v4 ou texto inválido devolvem `400 VALIDATION_FAILED`; UUID v7 inexistente devolve o problem `404 NOT_FOUND` exato desta feature.
- **fonte:** RFC-004 §§2, 3 e 6.
- **camada:** unit.

### A6: orçamento máximo de consultas

- **entrada:** consulta HTTP completa de Ana com indicador, dois indicados, dois endereços e duas PIX; segundo cenário com pessoa sem relacionamentos nem listas.
- **domínio:** contar somente chamadas a `client.query` do PGlite entre o início e o fim da requisição HTTP, excluindo o seed. Pessoa e indicador podem ser agregados em uma consulta; indicados, endereços e PIX podem ser consultados separadamente ou por JOIN.
- **saída:** ambas as respostas válidas em `PersonDetailResponse`.
- **erro:** nenhum.
- **fonte:** cartão E9-T10; ausência de N+1.
- **camada:** unit.

## Cenários

IDs fixos:

- Pessoa principal Ana: `01970000-0000-7000-8000-000000000001`.
- Indicador Carlos: `01970000-0000-7000-8000-000000000002`.
- Indicada Bruno: `01970000-0000-7000-8000-000000000003`.
- Indicada Diana: `01970000-0000-7000-8000-000000000004`.
- Pessoa inativa Ana inativa: `01970000-0000-7000-8000-000000000005`.
- Pessoa inexistente: `01970000-0000-7000-8000-000000000099`.
- UUID v4: `550e8400-e29b-41d4-a716-446655440000`.

CPFs fictícios:

- Ana: `52998224725`.
- Carlos: `11144477735`.
- Bruno: `39053344705`.
- Diana: `12345678909`.

- **C1 (A1):** Ana sem relacionamentos recebe exatamente a ficha vazia descrita em A1, sem opcionais e sem `contracts`.
- **C2 (A2):** seed Ana 001, Carlos 002, Bruno 003, Diana 004, os endereços 010/011 e PIX 012/013 com os literais e timestamps de A2; `GET` devolve o objeto exato de A2, com principal primeiro, secundário depois e indicados Bruno antes de Diana.
- **C3 (A3):** Ana possui endereço `01970000-0000-7000-8000-000000000010` criado `2026-01-01T10:00:00-03:00` e `...0011` criado `2026-01-02T10:00:00-03:00`, ambos secundários; PIX `...0012` criado `2026-01-03T10:00:00-03:00` e `...0013` criado `2026-01-04T10:00:00-03:00`, ambos secundários. Os quatro são mantidos como `isPrimary: false` e ordenados por `createdAt asc, id asc`: 010, 011 e 012, 013.
- **C4 (A4):** Ana inativa 005 com os três opcionais nulos; resposta omite opcionais e mantém `active: false`, com referrer, referrals, addresses e pixKeys vazios. Cenário separado usa Ana ativa 001 e Bruno 003 importado com `cpf: null`; resposta mantém CPF válido da pessoa principal e `"cpf": null` somente em Bruno.
- **C5 (A5):** texto inválido e UUID v4 recebem `400 VALIDATION_FAILED`; UUID v7 inexistente recebe `404 NOT_FOUND` com corpo exato.
- **C6 (A6):** a consulta completa de Ana usa o contador no `client.query` do PGlite reiniciado imediatamente antes da requisição HTTP e excluindo o seed; exige `queryCount <= 4`. Cenário separado com Ana sem indicador, indicados, endereços e PIX exige também `queryCount <= 4`. Mais de quatro consultas falha em ambos.

## Arquivos de teste previstos

- `apps/api/src/people/http/person-sheet.http.test.ts`: Supertest + PGlite migrado. Cobre C1–C6 com dados SQL reais e asserts exatos.
- `apps/api/src/people/http/people.http.test.ts`: teste protegido da E9-F03 cujo C8 básico no GET por id deve ser alinhado por E9-T09 à ficha agregada.
- Nenhum arquivo de teste em `packages/schemas` é previsto nesta feature; os schemas já estão no contrato fornecido e devem ser validados pelo cenário HTTP.
- E2E: nenhum. A execução ponta a ponta real pertence à E9-F11.

## Divergências com cartões e outras features

- E9-T09: o texto “contracts is an empty list until lending has an API” diverge do contrato: remover e exigir `personDetailResponse` sem campo `contracts`.
- E9-F03: o teste C8/A8 de `apps/api/src/people/http/people.http.test.ts`, que espera a resposta básica sem agregados, deixa de ser válido e deve ser alinhado por E9-T09 à `personDetailResponse`; esse arquivo entra em `allowedPaths` de E9-T09.
- E9-F04 já define que a repetição de PIX é aceita e que excluir principal não promove outro registro; esta feature não altera migrations ou contratos de endereço/PIX.
- A pessoa inativa pode aparecer como indicador ou indicado em resumos; `active: false` é preservado. Autorreferência continua impossível pela constraint `referred_by_id <> id` da RFC-005 §3.

## Pendências de PM

- Nenhuma: todas as lacunas desta feature já têm fonte aprovada ou decisão fixa do Joel.

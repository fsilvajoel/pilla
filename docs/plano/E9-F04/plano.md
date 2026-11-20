# Plano E9-F04: endereços e chaves PIX — um principal cada

Referências: PRD-001 RF-02; RFC-004 §§2, 3 e 6; RFC-005 §3; cartões E9-T07/T08 em `docs/plano/E9.yaml`; E9-F02; contratos existentes em `packages/schemas/src/api/people/`.

## Escopo

**Entra:**
- Endereços: `POST /api/v1/people/{id}/addresses`, `PATCH /api/v1/addresses/{id}` e `DELETE /api/v1/addresses/{id}`.
- Chaves PIX: `POST /api/v1/people/{id}/pix-keys`, `PATCH /api/v1/pix-keys/{id}` e `DELETE /api/v1/pix-keys/{id}`.
- Repositórios de infraestrutura, serviços de aplicação, controllers e registro dos controllers no módulo de pessoas.
- Uso dos schemas existentes: `addressSchema`, `createAddressRequest`, `updateAddressRequest`, `pixKeySchema`, `createPixKeyRequest` e `updatePixKeyRequest`. Não criar nem alterar schemas de endereço ou PIX.
- Persistência nas tabelas existentes `people.addresses` e `people.pix_keys`; não alterar outras tabelas; a única mudança de banco é remover `pix_keys_type_value_key` (migration 0002, E9-T08).
- Troca do principal dentro de uma transação.

**Fora:** ficha agregada (E9-F05), telas e E2E (E9-F10/F11), autenticação, alteração das tabelas e exclusão de pessoa.

**Comportamento fixado:**
- O primeiro endereço e a primeira chave PIX ficam principais, mesmo se `isPrimary` for omitido ou `false`.
- Criar ou atualizar outro registro com `isPrimary: true` torna-o principal e desmarca o anterior, na mesma transação. Omitir `isPrimary` ou enviar `false` não seleciona um novo principal.
- Excluir o principal é permitido. A pessoa pode ficar sem principal; não há promoção automática.
- `PATCH {}` é aceito e responde `200` com a representação atual, sem mudança. Escolha baseada em `updateAddressRequest` e `updatePixKeyRequest`, schemas parciais que aceitam objeto vazio; trata-se de no-op.
- Não há `version` no contrato de endereço ou PIX. PATCH é parcial e só aceita campos dos schemas; não há concorrência otimista, `If-Match`, `ETag`, `428` ou `VERSION_CONFLICT` para esses recursos. O versionamento da pessoa permanece independente.
- POST responde `201`; PATCH responde `200`; DELETE responde `204`, sem corpo.
- POST de endereço responde `Location: /api/v1/people/{id}/addresses/{addressId}`. POST de PIX responde `Location: /api/v1/people/{id}/pix-keys/{pixKeyId}`.
- Respostas de POST e PATCH são exatamente `addressSchema` ou `pixKeySchema`, sem colunas internas. `complement` é omitido quando ausente.
- Validação Zod somente na borda HTTP. Entrada inválida responde `400 VALIDATION_FAILED` em `application/problem+json`, com `errors` por campo e mensagens produzidas pelo schema.
- O schema PIX restringe `type` ao enum e `value` a texto aparado de 1–140 caracteres. Não acrescentar validação do formato de `value` conforme o tipo.

## Contrato

### Schemas existentes

- `packages/schemas/src/api/people/address.ts`: `addressSchema`, `Address`, `createAddressRequest`, `CreateAddressRequest`, `updateAddressRequest`, `UpdateAddressRequest`.
- `packages/schemas/src/api/people/pix-key.ts`: `pixKeyTypeSchema`, `PixKeyType`, `pixKeySchema`, `PixKey`, `createPixKeyRequest`, `CreatePixKeyRequest`, `updatePixKeyRequest`, `UpdatePixKeyRequest`.
- Os requests e as respostas usam exatamente esses schemas estritos. Não há `version` em `Address` ou `PixKey`.

### Contratos de aplicação e HTTP

A camada HTTP valida a entrada, chama a aplicação e traduz seus resultados para status e respostas. As regras ficam em `application/`; o acesso a dados fica em `infra/`, conforme E9-T06.

```ts
// apps/api/src/people/application/address-service.ts
export function createAddress(
  repository: AddressRepository,
  personId: string,
  id: string,
  input: CreateAddressRequest,
): Promise<Address | null>;

export function updateAddress(
  repository: AddressRepository,
  addressId: string,
  input: UpdateAddressRequest,
): Promise<Address | null>;

export function deleteAddress(
  repository: AddressRepository,
  addressId: string,
): Promise<boolean>;

// apps/api/src/people/application/pix-key-service.ts
export function createPixKey(
  repository: PixKeyRepository,
  personId: string,
  id: string,
  input: CreatePixKeyRequest,
): Promise<PixKey | null>;

export function updatePixKey(
  repository: PixKeyRepository,
  pixKeyId: string,
  input: UpdatePixKeyRequest,
): Promise<PixKey | null>;

export function deletePixKey(
  repository: PixKeyRepository,
  pixKeyId: string,
): Promise<boolean>;
```

`null` em criação indica pessoa inexistente; `null` em atualização e `false` em exclusão indicam recurso inexistente. O serviço de aplicação aplica a política de principal e coordena as operações da transação do repositório. Os repositórios usam `AddressRow` e `PixKeyRow` de `apps/api/src/people/infra/schema.ts`.

```ts
// apps/api/src/people/http/addresses.controller.ts
export class AddressesController {
  create(personId: string, body: CreateAddressRequest): Promise<Address>;
  update(addressId: string, body: UpdateAddressRequest): Promise<Address>;
  remove(addressId: string): Promise<void>;
}

// apps/api/src/people/http/pix-keys.controller.ts
export class PixKeysController {
  create(personId: string, body: CreatePixKeyRequest): Promise<PixKey>;
  update(pixKeyId: string, body: UpdatePixKeyRequest): Promise<PixKey>;
  remove(pixKeyId: string): Promise<void>;
}
```

Rotas dos controllers, relativas ao prefixo `/api/v1` configurado em E9-F02:
- `POST people/:id/addresses`, `PATCH addresses/:id`, `DELETE addresses/:id`.
- `POST people/:id/pix-keys`, `PATCH pix-keys/:id`, `DELETE pix-keys/:id`.

O módulo é `apps/api/src/people/people.module.ts`, criado/comissionado por E9-F03 e ampliado para registrar estes controllers e providers. A integração ao `AppModule` pertence à dependência E9-F03.

### Respostas e erros observáveis

- POST válido: `201 application/json`, `Location` conforme acima e corpo conforme o schema do recurso.
- PATCH válido: `200 application/json`, corpo atualizado conforme o schema. `{}` retorna o mesmo corpo, sem alteração.
- DELETE válido: `204`, corpo vazio.
- Pessoa inexistente no POST ou endereço/chave inexistente no PATCH/DELETE: `404 application/problem+json`, corpo:
  `{ "title": "Não encontrado", "status": 404, "detail": "Recurso não encontrado.", "code": "NOT_FOUND" }`.
- Entrada inválida: `400 application/problem+json`, corpo com `title: "Validação falhou"`, `status: 400`, `detail: "Dados inválidos."`, `code: "VALIDATION_FAILED"` e `errors` do pipe Zod. Cada campo recusado aparece em `errors`; `message` é o `issue.message` do schema.
- Chave PIX repetida (mesmo `type` e `value`, na mesma pessoa ou em outra): é permitida (decisão do Joel, 20/11: é um MVP). Responde `201` normalmente; não há erro de duplicidade, `409` nem código novo no catálogo. A pessoa também pode ficar sem nenhuma chave PIX.

## Arquivos de produção

| Arquivo | Domínio | Situação / motivo |
|---|---:|---|
| `apps/api/src/people/application/address-service.ts` | sim | Novo. Regra de primeiro principal, troca via `isPrimary: true` e manutenção do estado quando omitido/false. |
| `apps/api/src/people/application/pix-key-service.ts` | sim | Novo. Regras de principal da chave PIX equivalentes às de endereço. |
| `apps/api/src/people/infra/address-repository.ts` | não | Novo. Persistência transacional de endereços; sem regra de domínio de seleção do principal. |
| `apps/api/src/people/infra/pix-key-repository.ts` | não | Novo. Persistência transacional de chaves PIX; sem regra de domínio de seleção do principal. |
| `apps/api/src/people/http/addresses.controller.ts` | não | Novo. Rotas, validação Zod e tradução de resultados para HTTP. |
| `apps/api/src/people/http/pix-keys.controller.ts` | não | Novo. Rotas, validação Zod e tradução de resultados para HTTP. |
| `apps/api/src/people/people.module.ts` | não | E9-F03 cria o módulo; F04 o amplia para registrar controllers e providers desta feature. |
| `apps/api/src/people/infra/schema.ts` | não | Alterado (E9-T08): remove `unique("pix_keys_type_value_key").on(t.type, t.value)` de `pix_keys`. |
| `apps/api/migrations/people/0002_*.sql` (+ `meta/` gerado por `pnpm --filter @pilla/api db:regen pix_keys_allow_repeat people` (o `db:generate` só roda o módulo `core`)) | não | Novo (E9-T08): `ALTER TABLE people.pix_keys DROP CONSTRAINT pix_keys_type_value_key`. Migration criada pelo gerador, sem editar a 0001. |
| `docs/rfc/RFC-005-modelo-fisico-banco.md` | não | Alterado (E9-T08): §3 `pix_keys` deixa de ter `UNIQUE (type, value)` (decisão do Joel, 20/11). |

Não alterar `apps/api/src/people/infra/addresses.test.ts`. O teste SQL `apps/api/src/people/infra/pix-keys.test.ts` DEVE ser alterado no cartão E9-T07 (test-author): trocar a lista de índices esperados (sem `pix_keys_type_value_key`) e o caso que hoje espera erro `unique constraint` para a mesma chave (type, value) por um que espera sucesso; o E9-T08 o protege depois. Não criar migration além da 0002 acima.

## Domínio das entradas

A validação é feita pelos schemas existentes na borda HTTP. Rejeições respondem `400 VALIDATION_FAILED`; `errors` identifica o campo e usa a mensagem do Zod. Corpos estritos rejeitam propriedades extras.

| Entrada | Valores aceitos | Rejeições representativas | Erro exato esperado |
|---|---|---|---|
| `street` | Texto aparado, mínimo 1, máximo 150 caracteres | vazio, só espaços, 151 caracteres, valor não textual | `400 VALIDATION_FAILED`; `errors` contém `field: "street"` |
| `number` | Texto aparado, mínimo 1, máximo 20 caracteres | vazio, só espaços, 21 caracteres, valor não textual | `400 VALIDATION_FAILED`; `errors` contém `field: "number"`. É texto: `" 6 "` é aceito e aparado; `"1e1"`, `"-1"` e `"0"` também são textos válidos |
| `complement` | Opcional; se presente, texto aparado, mínimo 1, máximo 100 caracteres | `""`, só espaços, 101 caracteres, `null` | `400 VALIDATION_FAILED`; `errors` contém `field: "complement"`. Quando ausente, é omitido da resposta |
| `district` | Texto aparado, mínimo 1, máximo 100 caracteres | vazio, só espaços, 101 caracteres, valor não textual | `400 VALIDATION_FAILED`; `errors` contém `field: "district"` |
| `city` | Texto aparado, mínimo 1, máximo 100 caracteres | vazio, só espaços, 101 caracteres, valor não textual | `400 VALIDATION_FAILED`; `errors` contém `field: "city"` |
| `state` | Exatamente `^[A-Z]{2}$` | vazio, `"sp"`, `"S1"`, `" SP "`, caracteres fora do padrão | `400 VALIDATION_FAILED`; `errors` contém `field: "state"` |
| `postalCode` | Exatamente `^\d{8}$` | vazio, 7 ou 9 dígitos, `"01001-000"`, espaços, letra | `400 VALIDATION_FAILED`; `errors` contém `field: "postalCode"` |
| `address.isPrimary` | Booleano, opcional em create/PATCH | `null`, `"true"`, `1` | `400 VALIDATION_FAILED`; `errors` contém `field: "isPrimary"` |
| `type` de chave PIX | Um de `CPF`, `CNPJ`, `EMAIL`, `PHONE`, `RANDOM` | vazio, `"BANK"`, `"ALEATORIA"`, valor não textual | `400 VALIDATION_FAILED`; `errors` contém `field: "type"` |
| `value` de chave PIX | Texto aparado, mínimo 1, máximo 140 caracteres; sem validação adicional por `type` | vazio, só espaços, 141 caracteres, valor não textual | `400 VALIDATION_FAILED`; `errors` contém `field: "value"`. `" 6 "` é aceito e aparado; `"1e1"`, `"-1"` e `"0"` também são textos válidos |
| `pixKey.isPrimary` | Booleano, opcional em create/PATCH | `null`, `"true"`, `1` | `400 VALIDATION_FAILED`; `errors` contém `field: "isPrimary"` |
| IDs de rota | UUID v7 (`idSchema`) | vazio, UUID malformado, UUID v4 | `400 VALIDATION_FAILED` com `errors` para o parâmetro. UUID v7 válido sem registro correspondente: `404 NOT_FOUND` |
| Corpo JSON | Objeto permitido pelo schema estrito; PATCH contém somente campos parciais do contrato | `null`, array, tipo de campo incorreto, campo extra — inclusive `version` | `400 VALIDATION_FAILED` com `errors` para os campos recusados |

## Riscos

- **Chave PIX repetida e UNIQUE `(type, value)`:** o banco hoje tem `pix_keys_type_value_key` (migration `0001_people_tables.sql`, `schema.ts`, RFC-005 §3, teste SQL `pix-keys.test.ts` linha do `pg_indexes`). A decisão do Joel (20/11) permite chave repetida; por isso a constraint é removida no E9-T08 (migration 0002, `schema.ts`, RFC-005 §3) e o teste SQL ajustado no E9-T07. Sem a remoção, o segundo POST do mesmo `(type, value)` falharia com erro 500 do banco.
- **Concorrência na troca do principal:** operações de criação e alteração do principal devem ficar na mesma transação. O índice único parcial do banco continua protegendo contra dois principais.
- **Sem promoção após exclusão:** E9-T07 diz que excluir o principal promove o mais recente. A decisão fixa desta feature substitui esse comportamento: excluir retorna `204`, sem promoção automática; pode não haver principal.
- **Versionamento:** a regra geral da RFC-004 §2 e as colunas SQL `version` não acrescentam versão ao contrato desses recursos. Não implementar precondições ou conflitos de versão para endereço/PIX.
- **Validação PIX:** a redação de E9-T07 sobre validação “por tipo” diverge dos schemas existentes. Não acrescentar validação de formato ao `value`.
- **Dependência de E9-F03:** o módulo e a composição das rotas de pessoas são dependências; E9-F04 amplia o módulo, não integra outro módulo ao `AppModule`.

## Dependências

- E9-F01: banco, migrations e infraestrutura PGlite de teste.
- E9-F02: bootstrap NestJS, prefixo `/api/v1`, `ZodValidationPipe`, `ProblemException` e filtro `problem+json`.
- E9-F03: `PeopleModule`, rotas de pessoas e composição no `AppModule`.
- `@pilla/schemas`: schemas de Address/PixKey e `problemSchema`.
- Testes SQL protegidos `apps/api/src/people/infra/addresses.test.ts` e `apps/api/src/people/infra/pix-keys.test.ts`.

## Critérios de aceite

### A1: Criação de endereço e contrato de resposta

- entrada: `POST /api/v1/people/01970000-0000-7000-8000-000000000101/addresses`, corpo `{ "street": "Rua A", "number": "10", "district": "Centro", "city": "São Paulo", "state": "SP", "postalCode": "01001000" }`.
- domínio: create válido; primeiro endereço da pessoa; `isPrimary` omitido; sem `complement`.
- saída: `201 application/json`; `Location: /api/v1/people/01970000-0000-7000-8000-000000000101/addresses/01970000-0000-7000-8000-000000000201`; corpo exatamente `{ "id": "01970000-0000-7000-8000-000000000201", "street": "Rua A", "number": "10", "district": "Centro", "city": "São Paulo", "state": "SP", "postalCode": "01001000", "isPrimary": true }`; passa `addressSchema` e não contém `complement`.
- erro: nenhum.
- fonte: PRD-001 RF-02; RFC-004 §§2–3; RFC-005 §3; `address.ts`.
- camada: `unit`.

### A2: Domínio e validação de endereço

- entrada: corpos de POST e PATCH validados por `createAddressRequest` e `updateAddressRequest`.
- domínio: limites e formatos da tabela; PATCH só permite os campos do contrato; complemento ausente é válido, `null` não.
- saída: valores válidos passam no schema; campos `.trim()` são devolvidos aparados.
- erro: cada rejeição da tabela responde `400 application/problem+json` com `title: "Validação falhou"`, `status: 400`, `detail: "Dados inválidos."`, `code: "VALIDATION_FAILED"` e `errors` identificando os campos recusados; campos extras são rejeitados.
- fonte: `address.ts`, `common.ts` (`idSchema`, `stateSchema`, `postalCodeSchema`), RFC-004 §6 e RFC-005 §3.
- camada: `unit`.

### A3: Principal de endereço e troca transacional

- entrada: com pessoa `01970000-0000-7000-8000-000000000101`, criar o primeiro endereço `...0201` com `isPrimary: false`; criar `...0202` com `isPrimary: false`; criar `...0203` com `isPrimary: true`; atualizar `...0202` com `{ "isPrimary": true }`.
- domínio: primeiro endereço é principal apesar do `false`; o segundo não substitui o principal; POST/PATCH com `true` transfere o principal em transação.
- saída: POSTs respondem `201`, PATCH responde `200`; corpos passam `addressSchema`; após cada operação de troca, só o registro selecionado tem `isPrimary: true`; os demais são falsos.
- erro: nenhum.
- fonte: PRD-001 RF-02; RFC-005 §3 (índice único parcial); decisão fixa da feature.
- camada: `unit`, `mut`.

### A4: PATCH parcial/vazio e exclusão de endereço principal

- entrada: PATCH de endereço com `{ "street": "Rua B" }`, depois PATCH `{}`, PATCH `{ "isPrimary": false }` sobre o principal `...0201`, e DELETE de `...0201` quando `...0202` é não principal.
- domínio: campos omitidos permanecem; `{}` é no-op; `false` pode deixar a pessoa sem principal; exclusão não promove.
- saída: PATCH responde `200` com endereço completo conforme `addressSchema`; `{}` devolve exatamente o mesmo objeto. DELETE responde `204` sem corpo; depois da exclusão, `...0202` continua com `isPrimary: false`.
- erro: nenhum; não exigir `If-Match`, nem devolver `ETag`, `428` ou `VERSION_CONFLICT`.
- fonte: `updateAddressRequest` em `address.ts`; RFC-004 §3; decisões fixas da feature para PATCH vazio, versionamento e exclusão.
- camada: `unit`.

### A5: Pessoa/endereço inexistente e IDs

- entrada: POST com pessoa inexistente `01970000-0000-7000-8000-000000000199`; PATCH/DELETE de endereço inexistente `01970000-0000-7000-8000-000000000299`; parâmetro com UUID malformado ou UUID v4.
- domínio: IDs válidos são UUID v7; POST exige pessoa existente e PATCH/DELETE exigem endereço existente.
- saída: nenhum registro é criado ou alterado.
- erro: UUID inválido responde `400 VALIDATION_FAILED`, com erro no parâmetro; IDs v7 inexistentes respondem exatamente `404 application/problem+json` `{ "title": "Não encontrado", "status": 404, "detail": "Recurso não encontrado.", "code": "NOT_FOUND" }`.
- fonte: `common.ts` (`idSchema`); RFC-004 §§2–3 e 6; RFC-005 §3.
- camada: `unit`.

### A6: Criação de chave PIX e contrato de resposta

- entrada: `POST /api/v1/people/01970000-0000-7000-8000-000000000101/pix-keys`, corpo `{ "type": "EMAIL", "value": "  ana@example.com  " }`, primeira chave.
- domínio: tipo permitido; valor aparado; `isPrimary` omitido.
- saída: `201 application/json`; `Location: /api/v1/people/01970000-0000-7000-8000-000000000101/pix-keys/01970000-0000-7000-8000-000000000301`; corpo exatamente `{ "id": "01970000-0000-7000-8000-000000000301", "type": "EMAIL", "value": "ana@example.com", "isPrimary": true }`; passa `pixKeySchema`.
- erro: nenhum.
- fonte: PRD-001 RF-02; RFC-004 §§2–3; RFC-005 §3; `pix-key.ts`.
- camada: `unit`.

### A7: PATCH, principal e exclusão de chave PIX

- entrada: primeira chave `...0301` com `isPrimary: false`; segunda chave `...0302` com `isPrimary: false`; POST de `...0303` com `isPrimary: true`; PATCH de `...0302` com `{ "isPrimary": true }`, `{}` e `{ "isPrimary": false }`; DELETE do principal.
- domínio: a primeira chave é principal apesar do `false`; `true` em POST/PATCH transfere o principal; PATCH vazio não altera; DELETE do principal não promove outro.
- saída: POSTs `201`, PATCHes `200` com corpo `pixKeySchema`; `{}` devolve o mesmo objeto; DELETE `204` sem corpo; a chave restante mantém `isPrimary: false`.
- erro: nenhum; sem `If-Match`, `ETag`, `428` ou `VERSION_CONFLICT`.
- fonte: PRD-001 RF-02; RFC-005 §3; `updatePixKeyRequest` em `pix-key.ts`; decisões fixas da feature para exclusão e versionamento.
- camada: `unit`, `mut`.

### A8: Domínio e validação de chave PIX

- entrada: corpos de POST/PATCH validados por `createPixKeyRequest` e `updatePixKeyRequest`.
- domínio: `type` é um de `CPF`, `CNPJ`, `EMAIL`, `PHONE`, `RANDOM`; `value` é texto aparado de 1–140 caracteres, sem validação de formato específica do tipo; `isPrimary` é booleano opcional.
- saída: valores válidos passam no schema e o valor persistido/resposta vem aparado.
- erro: `type: "BANK"`, valor vazio/só espaços/141 caracteres, tipo incorreto e campo extra respondem `400 VALIDATION_FAILED`; `errors` identifica os campos recusados.
- fonte: `pix-key.ts`; RFC-005 §3; RFC-004 §6.
- camada: `unit`.

### A9: Chave PIX repetida e pessoa sem chave

- entrada: `POST /api/v1/people/01970000-0000-7000-8000-000000000101/pix-keys` com `{ "type": "EMAIL", "value": "ana@example.com" }` duas vezes seguidas; depois a mesma chave para a pessoa `01970000-0000-7000-8000-000000000102`.
- domínio: `(type, value)` não é único (decisão do Joel, 20/11: é um MVP); a pessoa pode ter zero chaves PIX.
- saída: os três POST respondem `201` com `pixKeySchema` e ids distintos; no banco existem três linhas com `type = 'EMAIL'` e `value = 'ana@example.com'`; na pessoa `...0101`, a primeira é principal e a segunda não; na pessoa `...0102` a chave nasce principal. Excluir todas as chaves de uma pessoa responde `204` e a deixa com zero chaves.
- erro: nenhum; não existe `409` nem código `DUPLICATE_PIX_KEY`.
- fonte: decisão do Joel (20/11/2026); PRD-001 RF-02; RFC-005 §3 (a `UNIQUE (type, value)` é removida pelo E9-T08).
- camada: `unit`.

## Cenários

UUIDs fixos (todos UUID v7):
- Pessoa: `01970000-0000-7000-8000-000000000101`.
- Endereços: `01970000-0000-7000-8000-000000000201`, `01970000-0000-7000-8000-000000000202`, `01970000-0000-7000-8000-000000000203`; endereço inexistente: `01970000-0000-7000-8000-000000000299`.
- Chaves: `01970000-0000-7000-8000-000000000301`, `01970000-0000-7000-8000-000000000302`, `01970000-0000-7000-8000-000000000303`; chave inexistente: `01970000-0000-7000-8000-000000000399`.
- Pessoa inexistente: `01970000-0000-7000-8000-000000000199`.

Nos cenários, `P1`, `A1`–`A3` e `K1`–`K3` referem-se, respectivamente, à pessoa, aos endereços e às chaves nessa lista. Usar Supertest e PGlite migrado.

- **C1 (A1, unit):** criar `A1` com o corpo de A1; verificar `201`, `Location` completo de A1, corpo exato de A1 e ausência de `complement`.
- **C2 (A2, unit):** enviar `street: ""`; verificar `400`, `VALIDATION_FAILED`, `detail: "Dados inválidos."` e `errors` com `field: "street"`.
- **C3 (A3, unit):** criar `A1` com `isPrimary: false`; verificar resposta `201` com `isPrimary: true`.
- **C4 (A3, unit):** criar `A2` com `isPrimary: false`; verificar resposta com `isPrimary: false` e `A1` continua principal.
- **C5 (A3, unit):** criar `A3` com `isPrimary: true`; verificar `201`, somente `A3` principal e `A1`/`A2` não principais.
- **C6 (A3, unit):** PATCH `A2` com `{ "isPrimary": true }`; verificar `200`, somente `A2` principal e `A1`/`A3` não principais.
- **C7 (A4, unit):** PATCH `A2` com `{ "street": "Rua B" }`; verificar `200`, `street: "Rua B"` e campos omitidos iguais aos valores anteriores.
- **C8 (A4, unit):** PATCH `A2` com `{}`; verificar `200` e corpo exatamente igual à representação anterior ao PATCH.
- **C9 (A4, unit):** PATCH do endereço principal com `{ "isPrimary": false }`; verificar `200`, principal desmarcado e nenhum outro endereço promovido.
- **C10 (A4, unit):** DELETE do principal `A1` com `A2` não principal; verificar `204`, corpo vazio, `A1` removido e `A2.isPrimary` falso.
- **C11 (A2, unit):** validar rejeições de endereço: `street` vazio/só espaços/151 caracteres; `number` vazio/só espaços/21 caracteres; `complement` vazio/só espaços/101 caracteres/nulo; `district` e `city` vazios/só espaços/101 caracteres; `state` `"sp"`, `"S1"`, `" SP "`; `postalCode` vazio, 7/9 dígitos, `"01001-000"`; `isPrimary: "true"`; campo extra e `version`. Para cada rejeição, verificar `400 VALIDATION_FAILED`, `detail: "Dados inválidos."` e `errors` com o campo correspondente.
- **C12 (A5, unit):** POST com pessoa `01970000-0000-7000-8000-000000000199` e PATCH/DELETE com endereço `01970000-0000-7000-8000-000000000299`; verificar o 404 exato de A5. UUID v4 ou malformado retorna `400 VALIDATION_FAILED` com erro no parâmetro.
- **C13 (A6, unit):** criar `K1` com o corpo de A6; verificar `201`, `Location` completo de A6 e corpo exato de A6, com valor aparado e principal.
- **C14 (A8, unit):** testar cada `type` permitido (`CPF`, `CNPJ`, `EMAIL`, `PHONE`, `RANDOM`) e `value: " 6 "`; verificar criação válida e valor `"6"` na resposta.
- **C15 (A7, unit):** criar `K1` com `isPrimary: false`; verificar que é principal. Criar `K2` com `isPrimary: false`; verificar que `K2` não é principal e `K1` permanece principal.
- **C16 (A7, unit):** criar `K3` com `isPrimary: true`; verificar `201`, somente `K3` principal.
- **C17 (A7, unit):** PATCH `K2` com `{ "isPrimary": true }`; verificar `200`, somente `K2` principal.
- **C18 (A7, unit):** PATCH `K2` com `{}`; verificar `200` e objeto sem mudança. PATCH de `K2` com `{ "isPrimary": false }`; verificar `200` e nenhum outro registro promovido.
- **C19 (A7, unit):** DELETE do principal `K2` com outra chave não principal; verificar `204`, corpo vazio e a chave restante continua não principal.
- **C20 (A8, unit):** testar `type: "BANK"`, `value` vazio/só espaços/141 caracteres, tipo incorreto, campo extra e `version`; verificar `400 VALIDATION_FAILED` e `errors` nos campos recusados.
- **C21 (A5, unit):** POST com pessoa inexistente e PATCH/DELETE com chave inexistente `01970000-0000-7000-8000-000000000399`; verificar o 404 exato de A5. UUID malformado retorna `400 VALIDATION_FAILED`.
- **C22 (A9, unit):** cadastrar `EMAIL`/`ana@example.com` para a pessoa `...0101` duas vezes e depois para `...0102`; verificar três `201`, ids distintos, três linhas no banco, principal conforme A9. Excluir as duas chaves de `...0101`; verificar `204` e zero chaves.

## Arquivos de teste previstos

- `apps/api/src/people/http/addresses.http.test.ts` — cenários C1–C12. Comando: `pnpm --filter @pilla/api exec vitest run src/people/http/addresses.http.test.ts`.
- `apps/api/src/people/http/pix-keys.http.test.ts` — cenários C13–C22. Comando: `pnpm --filter @pilla/api exec vitest run src/people/http/pix-keys.http.test.ts`.
- `apps/api/src/people/infra/pix-keys.test.ts` (SQL, existente) — alterado no E9-T07: índices esperados sem `pix_keys_type_value_key` e `(type, value)` repetido aceito.
- E2E: nenhum; o fluxo de usuário pertence à E9-F11.

## Pendências

1. **Nenhuma pendência de PM.** A chave PIX repetida está decidida pelo Joel (20/11).
2. **Alteração da UNIQUE PIX:** E9-T07 altera o teste SQL `pix-keys.test.ts`; E9-T08 remove `pix_keys_type_value_key` de `schema.ts` e gera a migration `0002`.
3. **Exclusão do principal:** os cenários C10/C19 fixam `204` sem promoção automática; endereço ou chave pode ficar sem registro principal.

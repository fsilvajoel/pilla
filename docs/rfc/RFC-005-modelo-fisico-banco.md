# RFC-005 — Modelo físico do banco (PostgreSQL)

| Campo | Valor |
|---|---|
| Status | Aprovado |
| Autor | Claude (tech lead) |
| Criado | 2026-11-14 |
| Implementa | [RFC-001](RFC-001-dominios-e-integracao.md) §3 |
| Depende de | [ADR-0002](../adr/0002-monolito-modular.md), [ADR-0004](../adr/0004-dinheiro-em-centavos.md), [ADR-0005](../adr/0005-valores-derivados.md), [ADR-0006](../adr/0006-registros-imutaveis-e-auditoria.md), [ADR-0012](../adr/0012-idioma-codigo-ingles-docs-portugues.md) |

---

## 1. Convenções

| Item | Regra |
|---|---|
| Schemas | um por módulo: `core`, `people`, `lending`, `payments`, `treasury`, `access` |
| Nomes | inglês, snake_case, tabelas no plural |
| Chave primária | `id uuid` (v7, gerado na aplicação) |
| Dinheiro | `bigint`, sufixo `_cents` ([ADR-0004](../adr/0004-dinheiro-em-centavos.md)) |
| Taxas | `integer`, sufixo `_bps` (1 bp = 0,01%) |
| Datas de negócio | `date`; instantes: `timestamptz` |
| Enums | `text` + `CHECK (col IN (...))` (migração mais simples que `enum` do PostgreSQL) |
| Auditoria de linha | `created_at`, `updated_at` (`timestamptz default now()`); `version integer` em tabelas editáveis |
| Entre módulos | **sem FK** entre schemas; só `uuid` + índice ([ADR-0002](../adr/0002-monolito-modular.md)) |
| Dentro do módulo | FK normal |
| Exclusão | nenhuma física em dados de negócio ([ADR-0006](../adr/0006-registros-imutaveis-e-auditoria.md)) |
| Calculados | **não** viram coluna ([ADR-0005](../adr/0005-valores-derivados.md)) |
| Permissões | cada módulo acessa só o próprio schema (verificado por teste; usuários de banco por módulo é evolução futura) |

## 2. `core`

**outbox**
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | id do evento |
| event_type | text | ex.: `PaymentConfirmed` |
| event_version | integer | |
| aggregate_id | uuid | |
| payload | jsonb | |
| occurred_at | timestamptz | |
| published_at | timestamptz null | null = pendente |
| attempts | integer default 0 | |
| last_error | text null | |

Índice parcial: `(occurred_at) WHERE published_at IS NULL`. O worker lê com `FOR UPDATE SKIP LOCKED`.

**processed_events**: `consumer text`, `event_id uuid`, `processed_at timestamptz` · PK `(consumer, event_id)` (idempotência).

**audit_log**: `id`, `actor_type` (`ADMIN`, `CLIENT`, `SYSTEM`), `actor_id uuid null`, `action text`, `entity_type text`, `entity_id uuid`, `before jsonb null`, `after jsonb null`, `ip inet null`, `at timestamptz` · índice `(entity_type, entity_id, at)`.

**attachments**: `id`, `kind` (`RECEIPT`, `SIGNED_CONTRACT`, `IMPORT_FILE`, `OTHER`), `file_name`, `content_type`, `size_bytes bigint`, `sha256 char(64)`, `storage_key text unique`, `uploaded_by uuid`, `uploaded_at`.

## 3. `people`

**persons**
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| full_name | text not null | |
| cpf | char(11) null | só dígitos; `UNIQUE` parcial `WHERE cpf IS NOT NULL`; null só em importação (RN-P01) |
| phone | text not null | E.164 (`+5511...`) |
| email | text null | |
| birth_date | date null | |
| referred_by_id | uuid null FK persons | `CHECK (referred_by_id <> id)` (RN-P02) |
| notes | text null | |
| active | boolean default true | |
| anonymized_at | timestamptz null | LGPD ([ADR-0006](../adr/0006-registros-imutaveis-e-auditoria.md)) |
| created_at, updated_at, version | | |

Índices: `cpf`, `lower(full_name)` (busca), `phone` (futuro WhatsApp), `referred_by_id`.

**addresses**: `id`, `person_id FK`, `street`, `number`, `complement`, `district`, `city`, `state char(2)`, `postal_code char(8)`, `is_primary` · `UNIQUE (person_id) WHERE is_primary`.

**pix_keys**: `id`, `owner_person_id FK`, `type` (`CPF`, `CNPJ`, `EMAIL`, `PHONE`, `RANDOM`), `value`, `is_primary` · `UNIQUE (owner_person_id) WHERE is_primary` (a mesma chave `(type, value)` pode se repetir: MVP).

## 4. `lending`

**default_terms** (histórico; vigente = maior `effective_from`)
`id`, `late_fee_bps`, `late_interest_monthly_bps`, `grace_period_days`, `suggested_monthly_rate_bps`, `rounding_step_cents` (padrão 500), `effective_from timestamptz`, `created_by uuid`.

**loans**
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| loan_number | text unique | `AAAA-NNNN` (sequência anual em `loan_number_sequences`) |
| person_id | uuid | → people (sem FK) |
| type | text | `INSTALLMENT`, `SINGLE_PAYMENT`, `INTEREST_ONLY`, `CUSTOM` |
| status | text | `DRAFT`, `ACTIVE`, `PAID_OFF`, `RENEWED`, `RENEGOTIATED`, `WRITTEN_OFF`, `CANCELLED` |
| principal_cents | bigint | `> 0` |
| monthly_interest_rate_bps | integer | `>= 0` |
| installment_count | integer null | `>= 1`; null só em `INTEREST_ONLY` |
| frequency_unit | text | `DAY`, `MONTH` |
| frequency_interval | integer | `>= 1` |
| first_due_date | date | |
| contracted_at | date | |
| disbursed_at | date null | `CHECK (status IN ('DRAFT','CANCELLED') OR disbursed_at IS NOT NULL)` |
| account_id | uuid null | → treasury (sem FK); `CHECK (status IN ('DRAFT','CANCELLED') OR account_id IS NOT NULL)` |
| origin_loan_id | uuid null FK loans | |
| origin_type | text null | `RENEWAL`, `RENEGOTIATION`, `IMPORT` |
| capitalized_amount_cents | bigint default 0 | RN-C17 |
| late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents | | cópia dos padrões ([ADR-0008](../adr/0008-condicoes-congeladas-no-contrato.md)) |
| write_off_reason | text null | |
| internal_notes | text null | nunca exposto no portal |
| status_changed_at | timestamptz | |
| created_at, updated_at, version | | |

Índices: `(person_id, status)`, `(status)`, `origin_loan_id`. Restrição: `first_due_date > disbursed_at` validada na aplicação (disbursed_at chega depois).

**installments** (gerado na ativação; fato imutável)
`id`, `loan_id FK`, `number integer`, `due_date date`, `principal_cents bigint`, `interest_cents bigint`, `total_cents bigint` · `CHECK (total_cents = principal_cents + interest_cents)` · `UNIQUE (loan_id, number)` · índice `(due_date)` (rotina diária e painel).
> Em `INTEREST_ONLY` a próxima parcela é inserida quando a anterior vence/é paga (RFC-002 §3.4).

**loan_number_sequences**: `year integer PK`, `last_value integer`.

## 5. `payments`

**payments**
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| loan_id | uuid | → lending (sem FK) |
| person_id | uuid | cópia para consulta do portal |
| account_id | uuid | → treasury |
| paid_at | date | |
| amount_cents | bigint | `> 0` |
| method | text | `PIX`, `BOLETO`, `CASH`, `BANK_TRANSFER` |
| receipt_attachment_id | uuid null | obrigatório exceto `CASH` (RN-R06; validado na aplicação) |
| pix_end_to_end_id | text null | `UNIQUE` parcial `WHERE pix_end_to_end_id IS NOT NULL` |
| channel | text | `ADMIN` (futuro `WHATSAPP`) |
| status | text | `PENDING_REVIEW`, `CONFIRMED`, `REVERSED`, `REJECTED` (pendente descartado; estado final, sem alocação) |
| is_recovery | boolean default false | RN-C20 |
| idempotency_key | text null unique | |
| confirmed_at/by, reversed_at/by, reversal_reason | | |
| rejected_at/by, rejection_reason | | preenchidos só em `REJECTED` (motivo obrigatório) |
| created_at, created_by | | |

Índices: `(loan_id, status)`, `(status) WHERE status = 'PENDING_REVIEW'`, `(person_id)`.

**payment_allocations** (append-only)
`id`, `payment_id FK`, `loan_id uuid`, `installment_id uuid`, `late_charges_cents`, `interest_cents`, `principal_cents` (todos `>= 0`), `reversed_at timestamptz null`, `created_at` · índices `(installment_id) WHERE reversed_at IS NULL`, `(loan_id)`.
> Valor pago de uma parcela = soma das alocações não estornadas (calculado).

## 6. `treasury`

**accounts**: `id`, `name`, `pix_key_id uuid null` (→ people), `description`, `max_committed_bps integer null`, `active`, `created_at`, `updated_at`, `version`.

**ledger_entries** (append-only)
| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK accounts | |
| type | text | `CAPITAL_IN`, `CAPITAL_OUT`, `DISBURSEMENT`, `REPAYMENT`, `REVERSAL`, `ADJUSTMENT` |
| amount_cents | bigint | com sinal; `<> 0` |
| component | text null | `PRINCIPAL`, `INTEREST`, `LATE_CHARGES`, `RECOVERY` |
| source_type | text null | `LOAN`, `PAYMENT` |
| source_id | uuid null | |
| source_event_id | uuid null | `UNIQUE (source_event_id, component)` → consumidor idempotente |
| entry_date | date | |
| justification | text null | obrigatório em `ADJUSTMENT` |
| created_by, created_at | | |

Índices: `(account_id, entry_date)`, `(source_type, source_id)`.

**loan_positions** (*read model*, opcional no MVP): `loan_id PK`, `account_id`, `status`, `outstanding_principal_cents`, `updated_at` — mantida pelos eventos de `lending`/`payments` para calcular capital emprestado e perdas sem consultar outro schema; **reconstruível** a partir dos eventos ([ADR-0005](../adr/0005-valores-derivados.md)).

## 7. `access`

**admin_users**: `id`, `username unique`, `password_hash`, `active`, `last_login_at`, `created_at`.
**sessions**: `id` (hash do token) PK, `role` (`ADMIN`, `CLIENT`), `admin_user_id uuid null`, `person_id uuid null`, `created_at`, `expires_at`, `last_seen_at`, `ip inet` · `CHECK` coerente com `role` · índice `(expires_at)`.
**portal_access**: `person_id uuid PK`, `enabled boolean`, `enabled_at`, `enabled_by`.
**access_logs**: `id`, `at`, `ip inet`, `cpf_hash char(64)`, `result` (`OK`, `NOT_FOUND`, `DISABLED`, `RATE_LIMITED`) · índice `(ip, at)` (limite por IP).

## 8. Migrações e dados

- Migrações com drizzle-kit, uma pasta por módulo, versionadas no git; **só para frente** (correção = nova migração).
- Seeds de desenvolvimento com dados **fictícios** (RNF-02); um seed reproduz os exemplos do PRD (CA-01 a CA-12).
- Testes de integração sobem um PostgreSQL real (Testcontainers) e rodam todas as migrações.

## 9. Questões abertas

- `loan_positions` já no MVP ou calcular o indicador por consulta pública de `lending`? Proposta: começar por consulta pública; criar o read model se ficar lento (bom experimento de escalabilidade).

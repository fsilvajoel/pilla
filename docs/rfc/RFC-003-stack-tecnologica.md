# RFC-003 — Stack tecnológica

| Campo | Valor |
|---|---|
| Status | Aprovado |
| Autor | Claude (tech lead) |
| Criado | 2026-11-14 |
| Relacionados | [ADR-0002](../adr/0002-monolito-modular.md), [ADR-0003](../adr/0003-eventos-de-dominio-com-outbox.md), [ADR-0004](../adr/0004-dinheiro-em-centavos.md) |
| Gera ADRs | [0010](../adr/0010-stack-typescript-ponta-a-ponta.md), [0011](../adr/0011-autenticacao-cpf-senha-sessao.md) |

---

## 1. Já definido (Joel)

- **Banco:** PostgreSQL.
- **Frontend:** Next.js + Tailwind CSS.
- **Todo código JS é TypeScript** (modo `strict`).
- **Backend:** Node **ou** Python, a decidir. Abaixo, a comparação e a recomendação.

## 2. Critérios

1. Monólito modular com fronteiras **verificáveis** em CI (ADR-0002).
2. Transação no PostgreSQL com outbox (ADR-0003).
3. Dinheiro sem ponto flutuante (ADR-0004).
4. **Máximo reúso** (objetivo do projeto): uma única implementação de cálculo, validação e contratos de API.
5. Convenções fortes, para que vários agentes produzam código consistente.
6. Ecossistema de testes maduro.
7. Prova de conceito de escalabilidade (API e worker escalando separados).

## 3. Node × Python

| Critério | Node + TypeScript | Python |
|---|---|---|
| Linguagem única com o front | ✅ uma só linguagem no repositório | ❌ duas linguagens |
| Reúso de cálculo (simulação no front = cálculo do back) | ✅ mesmo pacote `finance` | ❌ reescrever em TS ou sempre chamar a API |
| Reúso de validação/tipos | ✅ esquemas Zod compartilhados | ⚠️ gerar tipos TS a partir de OpenAPI |
| Módulos com fronteiras | ✅ NestJS (módulos + injeção de dependência) + dependency-cruiser | ✅ Django apps / FastAPI + import-linter |
| Dinheiro | ⚠️ sem Decimal nativo, resolvido com inteiros/BigInt (ADR-0004) | ✅ `Decimal` nativo |
| CRUD/admin pronto | ⚠️ não tem | ✅ Django Admin |
| Dados/ML (futuro score) | ⚠️ ecossistema fraco | ✅ forte |
| Consistência entre agentes | ✅ NestJS é muito opinativo | ✅ Django é opinativo |

### Recomendação: **Node + TypeScript** no núcleo

O objetivo declarado é **reúso máximo e domínios claros**. Com TypeScript ponta a ponta, o motor de cálculo (RFC-002), os esquemas de validação e os tipos dos eventos são escritos **uma vez** e usados pela API, pelo worker e pelo Next.js. A única vantagem real do Python aqui (Decimal) é neutralizada pela ADR-0004 (centavos inteiros).

A força do Python em dados não se perde: pela [ADR-0009](../adr/0009-funcionalidades-opcionais-como-modulos.md), o futuro **módulo de Score** pode ser um serviço Python separado consumindo eventos. Isso, aliás, é um bom estudo de arquitetura: extrair um módulo para outro serviço/linguagem sem tocar no núcleo.

## 4. Proposta detalhada

### 4.1 Estrutura (monorepo)

```
pilla/
├─ apps/
│  ├─ api/          NestJS: módulos de domínio + HTTP (REST)
│  │  └─ src/modules/{people,lending,payments,treasury,access}/
│  │       ├─ public/      interface exportada (serviços de comando/consulta, tipos)
│  │       ├─ domain/      entidades e regras (sem framework)
│  │       ├─ infra/       repositórios Drizzle, schema do módulo
│  │       └─ http/        controllers
│  ├─ worker/       mesmo código de módulos; entrypoint que roda outbox + rotinas
│  └─ web/          Next.js (App Router) + Tailwind
│       └─ app/{(admin),(portal)}/   dois layouts, mesmo app
├─ packages/
│  ├─ finance/      M0 Cálculo + Money + datas: TS puro, zero dependências de framework
│  ├─ schemas/      esquemas Zod de API e de eventos (versionados)
│  └─ config/       tsconfig, eslint, regras de fronteira
└─ infra/           docker-compose (postgres, minio), scripts
```

- Gerenciador: **pnpm workspaces** + **Turborepo** (build/test em cache, só o que mudou).
- `api` e `worker` são **processos separados do mesmo código**: escalam de forma independente.

### 4.2 Backend

| Item | Escolha | Por quê |
|---|---|---|
| Runtime | Node.js LTS | estável |
| Framework | **NestJS** | módulos e DI mapeiam direto para a ADR-0002; convenção forte para os agentes |
| Validação | **Zod** (via `packages/schemas`) | mesmo esquema no front e no back; gera OpenAPI |
| ORM/SQL | **Drizzle ORM** + drizzle-kit (migrações) | próximo do SQL, tipado, suporta schema por módulo e `SELECT … FOR UPDATE SKIP LOCKED` (outbox) |
| Fronteiras | **dependency-cruiser** no CI | falha o build se um módulo importar o interior de outro |
| Logs | pino (JSON) | estruturado; OpenTelemetry depois |
| API | REST + OpenAPI | simples, documentada automaticamente |

### 4.3 Banco (PostgreSQL)

- Um **schema por módulo** (`people`, `lending`, `payments`, `treasury`, `access`, `core`).
- Sem FK entre schemas (ADR-0002); integridade via aplicação.
- Dinheiro: `bigint` (centavos). Taxa: `integer` em escala 10⁻⁴ (6,33% = `633`); em TS, cálculo com `bigint` e arredondamento meio para cima, sem biblioteca decimal.
- Datas de negócio: `date` (sem hora). Instantes: `timestamptz`.
- **Outbox**: tabela `core.outbox`; o worker busca com `FOR UPDATE SKIP LOCKED`, o que permite **vários workers em paralelo** sem duplicar entrega. Tabela `core.processed_events` garante idempotência por consumidor.
- Rotinas agendadas (ex.: `ParcelaVencida` diário): **pg-boss** (fila sobre o próprio PostgreSQL, sem Redis no MVP).

### 4.4 Frontend

- **Next.js (App Router) + TypeScript + Tailwind**; componentes com **shadcn/ui** (código no repositório, sem lock-in).
- Formulários: React Hook Form + Zod (mesmo esquema da API).
- Simulação de empréstimo no ADMIN usa `packages/finance` **localmente** (resposta instantânea); ao gravar, a API recalcula e é a autoridade.
- Route groups `(admin)` e `(portal)` com layouts separados; portal pensado para celular primeiro.
- O Next.js **não acessa o banco**: fala só com a API (a segurança mora na API).

### 4.5 Autenticação (ADR-0011)

- Implementação própria no módulo `acesso` (regras simples, bom para estudo).
- CLIENTE: **só CPF**, leitura; limite por IP (ex.: `@nestjs/throttler`), registro de acessos.
- ADMIN: login + senha (hash **argon2id**); sessão em tabela própria, cookie `httpOnly`, `Secure`, `SameSite=Lax`.

### 4.6 Anexos

- Armazenamento **S3-compatível**: **MinIO** no desenvolvimento, qualquer S3 em produção.
- Upload/download por URL assinada de curta duração; banco guarda só metadados + hash.

### 4.7 Qualidade

| Tipo | Ferramenta |
|---|---|
| Unitário (cálculo, regras) | **Vitest**; casos da RFC-002 e CA do PRD obrigatórios |
| Propriedades (somas sempre fecham) | fast-check |
| Integração com banco real | **Testcontainers** (PostgreSQL) |
| Ponta a ponta | **Playwright** (fluxos admin e portal) |
| Arquitetura | dependency-cruiser |
| CI | GitHub Actions: lint, typecheck, testes, regras de fronteira |

### 4.8 Ambiente

- `docker compose` com PostgreSQL e MinIO para desenvolvimento.
- Configuração só por variáveis de ambiente (`.env` / `.env.example`), conforme CLAUDE.md.
- Deploy: definido depois (containers `api`, `worker`, `web`).

## 5. Expansão: módulo de atendimento por WhatsApp

Requisito futuro (Joel): bot no WhatsApp para o cliente consultar o status, enviar comprovante e ter a dívida baixada automaticamente. **Node sustenta bem esse caminho:**

| Necessidade do bot | Em Node/TypeScript |
|---|---|
| Receber mensagens (webhooks da **WhatsApp Cloud API** oficial) | HTTP + I/O assíncrono é o ponto forte do Node; um controller NestJS a mais |
| Responder rápido e aguentar muitas conversas simultâneas | event loop sem bloqueio; o processamento pesado vai para o worker via fila (pg-boss) |
| Entender perguntas em linguagem natural | SDKs oficiais de LLM em TypeScript (Anthropic, OpenAI) e Vercel AI SDK, todos de primeira linha |
| Ler o comprovante (imagem/PDF) e extrair valor, data, pagador e id da transação PIX | modelo de linguagem com visão e saída estruturada validada por **Zod** (o mesmo `packages/schemas`) |
| Baixar a dívida | chama o comando público de M3 (`registrarPagamentoPendente`); confirmação automática é regra de M3 (RFC-001 §7) |
| Mensagens ativas (lembrete de vencimento) | consumidor dos eventos `ParcelaVencida` no worker |
| Conciliação futura com o banco (API PIX) | SDKs/HTTP comuns |

Se algum dia surgir uma necessidade em que Python é muito melhor (ex.: modelo próprio de score ou de OCR), ela entra como **serviço separado consumindo eventos** (ADR-0009). O núcleo continua em Node.

Cuidado: usar só a **API oficial** do WhatsApp; bibliotecas não oficiais (que simulam o WhatsApp Web) violam os termos e podem ter o número banido (legal L-09).

**Preparação já no MVP**, sem custo extra: consultas de situação como serviços públicos reutilizáveis, `id_transacao_pix` e `canal_origem` no Pagamento, comprovante como Anexo genérico, eventos publicados desde o início.

## 6. Alternativas consideradas

- **Python (FastAPI/Django)**: ver §3. Reservado para o futuro módulo de Score.
- **Fastify sem framework**: mais leve, mas cada agente inventaria sua própria estrutura de módulo.
- **Prisma**: produtivo, mas menos controle de SQL (outbox com `SKIP LOCKED`, schemas por módulo).
- **Next.js como backend (route handlers/server actions com regras de negócio)**: mistura apresentação e domínio; dificulta worker separado e outros clientes (app móvel).
- **NextAuth/Auth.js**: bom para OAuth; para acesso por CPF e login simples de ADMIN, implementação dedicada é mais simples e clara.
- **Redis/BullMQ** para filas: componente extra desnecessário no MVP (pode entrar se o volume do WhatsApp exigir).

## 7. Questões abertas

- Onde será o deploy (impacta só a fase final).

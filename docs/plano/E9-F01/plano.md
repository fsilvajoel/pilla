# E9-F01: banco de desenvolvimento (Docker + PostgreSQL + migrations + seed)

Plano da feature (etapa 1). Cartão: `docs/plano/E9.yaml`, E9-T01 (kind implement, sem cartão de teste). Referências: RFC-003 §4.8, RFC-005 §3 e §8, `docs/plano/E9.md` D2, D3 e D4, PRD-001 RF-01 a RF-03, RN-P01 e RN-P02, RNF-02.
Não é cartão de tela: não leva `shadcn` nem `tailwind-css`.

## Escopo

Entra:
- `infra/docker-compose.yml`: serviço `postgres` (imagem `postgres:17`, decisão P4 de 19/11), porta publicada só em `127.0.0.1`, volume nomeado, `healthcheck` (para o `up -d --wait`), credenciais lidas de variáveis do `.env`.
- `apps/api/scripts/migrate.mts`: aplica as migrações drizzle de todas as pastas de `apps/api/migrations/` em `DATABASE_URL`, na ordem de `migrationFolders` (`apps/api/src/db/migrate.ts`), com a mesma tabela de controle por pasta (`drizzle.migrations_<pasta>`). Idempotente.
- `apps/api/scripts/seed.mts`: 6 pessoas fictícias (CPF válido, telefone E.164), com endereços, chaves PIX e uma indicação (RN-P02). Idempotente.
- `apps/api/package.json`: scripts `db:migrate` e `db:seed` e as dependências `pg` e `@types/pg` (P2 aprovado em 19/11).
- `.env.example` (versionado) e `.env` local (não versionado): variáveis novas nos dois; só o `.env.example` entra no commit (A4; o hook bloqueia escrita em `.env`).
- `docs/dev/banco-local.md` (pt-BR): subir, migrar, semear e zerar.
- Fora: instalar o Docker (feito fora do repo, na VM de desenvolvimento), MinIO (RFC-003 §4.8 cita; nenhuma feature da E9 usa), provider de banco da API (E9-F02), seed dos exemplos CA-01 a CA-12 do PRD (RFC-005 §8; só o cadastro de pessoas é da E9), qualquer alteração em `src/`, produção e testes Vitest.

Cartões: `docs/plano/E9.yaml` (E9-T01).

## Contrato

Feature de infra e scripts: **não há contrato de código** para os testes consumirem, logo não há esboço nem exclusão de cobertura. Interfaces operacionais (nomes exatos):

- `pnpm --filter @pilla/api db:migrate` e `pnpm --filter @pilla/api db:seed` (sem argumentos; saída 0 em sucesso, diferente de 0 com a mensagem do erro em stderr).
- `docker compose -f infra/docker-compose.yml up -d --wait` (serviço `postgres`, imagem `postgres:17`, volume `pilla-pgdata`).
- Variáveis (todas no `.env.example`, uma linha de comentário cada): `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`. Valores de exemplo fictícios; o `.env` local não entra no git.

## Arquivos de produção

Nenhum é de domínio (infra e cola); `domainSources` fica vazio e o gate de mutação não tem o que medir.

| Arquivo | Domínio |
|---|---|
| `infra/docker-compose.yml` | não |
| `apps/api/scripts/migrate.mts` | não |
| `apps/api/scripts/seed.mts` | não |

`sources` do estado lista só `apps/api/scripts/*.mts` e o compose; `apps/api/package.json`, `.env.example` e `docs/dev/banco-local.md` são configuração e doc, fora de `sources`.

## Domínio das entradas

| Entrada | Formato aceito | Mínimo | Máximo | Exemplos rejeitados | Erro esperado | Fonte |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | URL `postgres://usuario:senha@host:porta/banco` | presente e não vazia | sem limite definido | ausente, `""`, `"   "`, `localhost:5432`, `mysql://...`, porta `abc`, `postgres://u:p@db.example.com:5432/pilla` | `db:migrate` e `db:seed` saem com código 1 e dizem em stderr que `DATABASE_URL` falta ou é inválida; nenhuma conexão é aberta; `db:seed` também recusa host que não seja `127.0.0.1` ou `localhost` (P3) | `docs/plano/E9.md` D2 e D4 (`.env`); CLAUDE.md (config só por env); decisão P3 (19/11) |
| `POSTGRES_PORT` | inteiro decimal sem sinal, sem espaço | 1024 | 65535 | `""`, `" 5432 "`, `5432.0`, `65536`, `abc` | `docker compose` recusa valor não numérico ou acima de 65535; abaixo de 1024 o compose não recusa, a faixa 1024–65535 é regra documentada (P4) no `.env.example` e em `docs/dev/banco-local.md`; o compose publica só em `127.0.0.1` | RFC-003 §4.8; D3 (somente 127.0.0.1); decisão P4 (19/11): faixa 1024–65535 |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | texto não vazio, sem espaço | 1 caractere | sem limite definido | ausente (o compose falha com `${VAR:?}`) | `docker compose up` sai com erro dizendo qual variável falta | RFC-003 §4.8 |
| `.env` x `.env.example` | mesmas chaves nos dois | n/a | n/a | chave em um e ausente no outro | `node scripts/check-env-example.mjs` sai com código 1 e lista a chave | cartão E9-T01 `done`; travas §7 |
| `apps/api/migrations/<pasta>/` | pastas de `migrationFolders` com `meta/_journal.json` | 1 pasta | 6 pastas hoje | pasta ausente | a migração falha com o erro do drizzle e sai com código diferente de 0 | RFC-005 §8 |
| Linhas do seed (constantes do script) | CPF `^[0-9]{11}$` com dígitos verificadores corretos; telefone `^[+][1-9][0-9]{7,14}$`; `state` `^[A-Z]{2}$`; `postal_code` `^[0-9]{8}$`; PIX `type` em `CPF, CNPJ, EMAIL, PHONE, RANDOM` | 6 pessoas | 6 pessoas | CPF repetido, CPF com dígito errado, indicador igual à própria pessoa, 2 endereços ou 2 PIX principais da mesma pessoa | o banco rejeita (CHECK ou índice único) e o seed sai com código 1; nunca grava parcialmente (uma transação) | RN-P01, RN-P02, RFC-005 §3; a quantidade 6 (e 8 endereços, 8 PIX) é escolha do plano com dados fictícios (RNF-02), ajustável pelo PM |

Nenhum outro parâmetro de linha de comando existe.

## Riscos

- O `.env` real nunca é impresso, comitado nem lido pelo agente além das chaves; `.env.example` só com valores fictícios (repositório público).
- O seed grava dado fictício: rodar contra o banco errado (produção) misturaria dado de teste. Mitigação aprovada em P3 (recusa de host fora de `127.0.0.1`/`localhost`).
- `pg` não está instalado; P2 (19/11) aprovou `pg`, `@types/pg` e `pnpm-lock.yaml` no `allowedPaths` do E9-T01. A lista de dependências permitidas (`docs/travas.md`) precisa citar `@types/pg`, por isso o cartão inclui `docs/travas.md` no escopo e o check `node scripts/check-allowed-deps.mjs`.
- Os scripts são `.mts` fora de `src/` e do `tsconfig.json` do pacote (`include: src, drizzle-kit`): não passam pelo typecheck nem pela cobertura da API. Tipagem forte vale mesmo assim; ver P1.
- Idempotência do seed depende de ids fixos (uuid literal) e `ON CONFLICT DO NOTHING`; sem isso, rodar duas vezes duplicaria ou falharia no CPF único.
- Dado já apagado no volume não volta sozinho: o reset (`down -v`) é só em desenvolvimento e está documentado.

## Dependências

- Docker e o plugin Compose instalados na VM de desenvolvimento (fora do repo, parte do `done`; o planejamento não roda docker).
- Migrações já commitadas em `apps/api/migrations/{core,people,lending,payments,treasury,access}`; ordem em `src/db/migrate.ts`.
- Libs: `drizzle-orm/node-postgres` (já é dependência) e `pg` e `@types/pg` (P2 aprovado em 19/11); `tsx` já existe como dev dependency do monorepo.
- Nenhuma feature anterior; E9-F02 depende desta.

## Critérios de aceite

Camada: critério de infra provado por comando contra o PostgreSQL real (checks do cartão E9-T01), classificado como `e2e` por ser prova de ponta a ponta fora do PGlite. Ver P1: sem arquivo de teste previsto.

### A1: o PostgreSQL de desenvolvimento sobe saudável e isolado
- entrada: `docker compose -f infra/docker-compose.yml up -d --wait` com `.env` preenchido
- domínio: `POSTGRES_*`
- saída: sai com código 0 com o serviço `postgres` `healthy`; a imagem é `postgres:17` (P4); `docker compose -f infra/docker-compose.yml config` mostra a porta publicada como `127.0.0.1:${POSTGRES_PORT}:5432`, com `POSTGRES_PORT` na faixa 1024–65535 (P4), e o volume nomeado `pilla-pgdata`; os dados sobrevivem a `down` + `up` (sem `-v`)
- erro: variável `POSTGRES_*` ausente: o compose falha dizendo qual; `POSTGRES_PORT` não numérica ou acima de 65535: o compose recusa subir; abaixo de 1024 a faixa é regra documentada (P4) no `.env.example` e em `docs/dev/banco-local.md`
- fonte: RFC-003 §4.8; `docs/plano/E9.md` D2 e D3; decisão P4 (19/11); cartão E9-T01 `done` (1)
- camada: e2e

### A2: db:migrate cria o schema completo e é idempotente
- entrada: `pnpm --filter @pilla/api db:migrate` num banco vazio, e de novo logo depois
- domínio: `DATABASE_URL`, pastas de migração
- saída: 1ª execução cria os schemas `core`, `people`, `lending`, `payments`, `treasury`, `access` e as tabelas (ex.: `people.persons`, `people.addresses`, `people.pix_keys`), código 0; 2ª execução termina com código 0 sem criar nada novo (`drizzle.migrations_<pasta>` com o mesmo número de linhas)
- erro: `DATABASE_URL` ausente ou inválida: código 1, mensagem em stderr, sem conexão
- fonte: RFC-005 §8; cartão `done` (2)
- camada: e2e

### A3: db:seed insere as pessoas fictícias e é idempotente
- entrada: `pnpm --filter @pilla/api db:seed` depois do migrate, e de novo
- domínio: constantes do seed
- saída: `people.persons` fica com 6 linhas, todas com CPF de 11 dígitos válido pelo cálculo dos dígitos verificadores e telefone E.164; exatamente 1 com `referred_by_id` preenchido (Bruno, indicado por Ana); cada pessoa tem ao menos 1 endereço e 1 chave PIX; exatamente 1 endereço e exatamente 1 PIX principais por pessoa; a 2ª execução termina com código 0 e as contagens não mudam (6 / 8 / 8)
- erro: banco sem migração ou `DATABASE_URL` inválida: código 1 e mensagem em stderr; nada gravado; `DATABASE_URL` com host fora de `127.0.0.1`/`localhost`: código 1 e mensagem clara, sem conexão (P3)
- fonte: RF-01, RF-02, RF-03, RN-P01, RN-P02, RFC-005 §3 e §8 (dados fictícios, RNF-02); decisão P3 (19/11); cartão `done` (3)
- camada: e2e

### A4: variáveis novas sincronizadas e sem segredo no git
- entrada: `node scripts/check-env-example.mjs` após a feature
- domínio: `.env` x `.env.example`
- saída: código 0 com "env ok"; `.env.example` traz `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `POSTGRES_PORT`, cada uma com comentário e valor fictício; `.env` não está versionado
- erro: chave em só um dos arquivos: código 1 e a chave listada
- fonte: cartão `done` (4); AGENTS §9 e §10
- camada: e2e

### A5: documentação do fluxo local
- entrada: leitura de `docs/dev/banco-local.md`
- domínio: n/a
- saída: o arquivo, em pt-BR, traz os comandos exatos de subir (`up -d --wait`), migrar (`db:migrate`), semear (`db:seed`) e zerar (`down -v`, seguido de up, migrate e seed), as variáveis do `.env.example` com a faixa 1024–65535 de `POSTGRES_PORT` (P4) e o aviso de que o banco é só de desenvolvimento
- erro: nenhum
- fonte: cartão `done` (5); decisão P4 (19/11)
- camada: e2e (conferência pelo reviewer, sem teste automático)

## Cenários

Sem arquivo de teste (ver P1). Os checks do cartão cobrem só o caminho feliz; os casos de erro (C2, C3, C5, C8 e C9) não têm check automático e são conferidos pelo reviewer, que roda o comando com a entrada inválida e confere código de saída e mensagem.

- C1 (A1, e2e): `up -d --wait` com `.env` válido sai 0 e `docker compose ps` mostra `postgres` healthy; `config` mostra a porta em `127.0.0.1` (fonte D2, D3)
- C2 (A1, e2e): com `POSTGRES_PASSWORD` removida do ambiente, `docker compose config` falha dizendo que a variável é obrigatória (rejeição de `POSTGRES_*`)
- C3 (A1, e2e): `POSTGRES_PORT=65536` e `abc` são recusados pelo compose ou pelo Postgres; nenhuma porta é publicada em `0.0.0.0` (rejeição de `POSTGRES_PORT`; faixa 1024–65535, P4)
- C4 (A2, e2e): `db:migrate` em banco vazio sai 0 e `people.persons` existe; 2ª execução sai 0 sem linha nova em `drizzle.migrations_*` (RFC-005 §8)
- C5 (A2, e2e): `DATABASE_URL` vazia, `"   "` e `mysql://x` fazem `db:migrate` sair 1 com mensagem em stderr (rejeição de `DATABASE_URL`)
- C6 (A3, e2e): `db:seed` insere 6 pessoas, 8 endereços e 8 chaves PIX; 1 pessoa com indicador; todas com CPF válido (RN-P01, RN-P02)
- C7 (A3, e2e): `db:seed` 2ª vez sai 0 com as mesmas contagens 6 / 8 / 8
- C8 (A3, e2e): `db:seed` num banco sem migração sai 1 e deixa o banco sem linhas; `DATABASE_URL` ausente sai 1; `DATABASE_URL` com host `db.example.com` sai 1 com mensagem clara e sem conexão (P3) (rejeição de `DATABASE_URL`; linhas do seed rejeitadas pelo banco, por ex. CPF repetido, caem no mesmo caminho)
- C9 (A4, e2e): `check-env-example.mjs` sai 0; remover uma chave do `.env.example` faz sair 1 listando-a (rejeição de `.env` x `.env.example`)
- C10 (A5, e2e): o reviewer confere em `docs/dev/banco-local.md` os quatro fluxos e os comandos exatos

Dados do seed (literais no script, sem cálculo em tempo de execução; CPFs conferidos pelos dígitos verificadores):

| Pessoa | CPF | Indicada por |
|---|---|---|
| Ana Souza | 12345678909 | nenhuma |
| Bruno Lima | 11144477735 | Ana Souza |
| Carla Dias | 10020030088 | nenhuma |
| Diego Rocha | 21436587107 | nenhuma |
| Elisa Prado | 31415926590 | nenhuma |
| Fábio Nunes | 27182818205 | nenhuma |

Telefones `+5511999990001` a `+5511999990006`. Ids: uuid literais fixos escolhidos pelo implementer (RFC-005 §3 pede v7; sem a dependência `uuidv7`, constantes). Endereços: 8 no total, ao menos 1 por pessoa, exatamente 1 principal por pessoa (quem tem um só endereço, esse é o principal). PIX: 8 no total, ao menos 1 por pessoa, tipos variados, exatamente 1 principal por pessoa (quem tem uma só chave, essa é a principal). A divisão exata dos 8 e dos 8 fica a cargo do implementer, dentro desses limites (A3 fixa só as contagens e as regras).

## Arquivos de teste previstos

- Vitest: nenhum (os scripts ficam fora de `src/` e da cobertura da API). Ver P1.
- e2e Playwright: nenhum. A prova são os `checks` do cartão E9-T01 e a conferência do reviewer.

## Detalhe para o cartão (done, hints, readFirst)

- done: os 12 itens do E9.yaml (A1 a A5, C1 a C10, P2, P3 e P4), entre eles: o compose publica `127.0.0.1:${POSTGRES_PORT}:5432`, usa a imagem `postgres:17` e declara `healthcheck`; `db:migrate` e `db:seed` falham com código 1 e mensagem clara sem `DATABASE_URL`; o seed roda numa transação e recusa host fora de `127.0.0.1`/`localhost`; `pg` e `@types/pg` instalados com `pnpm-lock.yaml` atualizado e `docs/travas.md` com `@types/pg` na lista de Dev.
- hints:
  - Carregar o `.env` da raiz com `node --env-file=../../.env` (cwd do `pnpm --filter` é `apps/api`) e rodar com `tsx` (`"db:migrate": "node --env-file=../../.env --import tsx scripts/migrate.mts"`); `.mts` com imports relativos sem extensão exigem `tsx`.
  - O migrator é `drizzle-orm/node-postgres/migrator` com `migrationsFolder: "migrations/<pasta>"`, `migrationsSchema: "drizzle"`, `migrationsTable: "migrations_<pasta>"`; reaproveitar `migrationFolders` de `src/db/migrate.ts` para não duplicar a ordem.
  - Seed: `INSERT ... ON CONFLICT DO NOTHING` por `id`, uma transação, pessoas antes dos endereços e PIX; indicado inserido depois do indicador (FK `persons_referred_by_id_fkey`). Campos opcionais omitidos, não `undefined` (lição E5-F02).
  - Sem `any`; `Pool` do `pg` fechado em `finally`; nunca logar `DATABASE_URL` nem a senha.
  - Compose: `${VAR:?mensagem}` nas variáveis obrigatórias, imagem com tag fixa `postgres:17` (P4), volume nomeado `pilla-pgdata`, `healthcheck` para o `up -d --wait`.
  - Dados do seed: Ana Souza 12345678909, Bruno Lima 11144477735 (indicado por Ana), Carla Dias 10020030088, Diego Rocha 21436587107, Elisa Prado 31415926590, Fábio Nunes 27182818205; telefones `+5511999990001` a `+5511999990006`; ids uuid literais fixos escolhidos pelo implementer; 8 endereços e 8 chaves PIX, ao menos 1 de cada por pessoa, exatamente 1 principal por pessoa (inclusive quem tem um só).
  - A recusa de host (P3) lê o host de `DATABASE_URL` e aceita só `127.0.0.1` e `localhost`, saindo 1 com mensagem em stderr antes de abrir conexão.
  - A faixa 1024–65535 de `POSTGRES_PORT` (P4) vai no comentário do `.env.example` e em `docs/dev/banco-local.md`; a recusa de valor não numérico ou acima de 65535 vem do compose ou do Postgres (C3).
  - `@types/pg` entra em `devDependencies` de `apps/api/package.json` e na lista de Dev de `docs/travas.md`, senão `node scripts/check-allowed-deps.mjs` falha (P2, travas §7).
- readFirst: `docs/plano/E9-F01/plano.md`, `docs/plano/E9.md` (D2, D3), `docs/rfc/RFC-003-stack-tecnologica.md` §4.8, `docs/rfc/RFC-005-modelo-fisico-banco.md` §3 e §8, `apps/api/src/db/migrate.ts`, `apps/api/src/people/infra/schema.ts`, `apps/api/migrations/people/*.sql`, `.env.example`, `scripts/check-env-example.mjs`, `docs/travas.md` (Dependências permitidas), `docs/memoria/README.md`.

## Decisões (19/11, resposta do Joel)

- P1 (prova sem teste): **mantido como está.** Os scripts `.mts` ficam fora de `src/` e da cobertura; os critérios são provados só pelos `checks` do cartão E9-T01 e pela conferência do reviewer. Sem cartão de teste novo.
- P2 (dependências): **aprovado** incluir `pg` (instalar), `@types/pg` e `pnpm-lock.yaml` no escopo do E9-T01 (`allowedPaths`).
- P3 (segurança do seed): **aprovado.** `db:seed` recusa `DATABASE_URL` cujo host não seja `127.0.0.1` ou `localhost`, com código 1 e mensagem clara.
- P4 (porta): **aprovado** faixa 1024 a 65535 para `POSTGRES_PORT`.
- P4 (versão do PostgreSQL): **PostgreSQL 17**, escolhido pelo Joel. Nenhuma RFC fixa o major; a imagem fica fixada na tag `postgres:17` no compose.

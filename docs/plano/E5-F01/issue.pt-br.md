# [E5-F01] Fundação do comando da API (IDs UUID v7 e registro de auditoria)

<!-- ada-feature:E5-F01 -->

> Entrega **E5** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E5-T01 (Bia): `apps/api/src/core/public/ids.test.ts`, os testes de `uuidV7` e `newId`.
- E5-T02 (Alice): `apps/api/src/core/public/ids.ts` (UUID v7 da RFC 9562 §5.7, sem dependência nova) e a saída da trava do stub no `vitest.config.ts`.
- E5-T03 (Bia): `apps/api/src/core/public/audit.test.ts`, os testes de `recordAudit` contra o PGlite migrado.
- E5-T04 (Alice): `apps/api/src/core/public/audit.ts` (insert em `core.audit_log`) e a saída da trava do stub.
- Fora: vocabulário de `action`/`entityType`, ator sem autenticação, auditoria dentro de transação de caso de uso e qualquer outro arquivo (decisões do Joel, lista do relatório de 17/11).

## Regras e critérios

- A1: `uuidV7` devolve o texto do vetor da RFC 9562 A.6 e respeita versão 7 e variante 10 nos limites.
- A2: `uuidV7` lança `RangeError` para tempo fora de 48 bits, não inteiro ou negativo, e para random diferente de 10 bytes.
- A3: `newId` gera UUID v7 válido, distinto a cada chamada, com o tempo da chamada.
- A4: `recordAudit` grava a entrada como veio, com nulos, e o erro do banco sobe sem tratamento.
- A5: todos os testes passam com 100% de linhas e ramos de `ids.ts` e `audit.ts`; typecheck e lint verdes; nenhuma linha `@stub` nem exclusão no `vitest.config.ts`.

## Contrato

_Sem contrato no plano._

## Cartões

### E5-T01 — Escrever os testes para uuidV7 e newId

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [RFC-004 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [RFC-005 §1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- Ler antes: `apps/api/src/core/public/ids.ts`

**DoD (definição de pronto)**
- todos os testes falham atualmente contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import { describe, expect, it } from "vitest";
- import { newId, uuidV7 } from "./ids";
- uuidV7 de unixMs 1645557742000 e os bytes aleatórios das dicas resulta em "017f22e2-79b0-7cc3-98c4-dc0c0c07398f" (RFC-004 §2, vetor de teste do RFC 9562 A.6)
- uuidV7 de 0 e 10 bytes zero resulta em "00000000-0000-7000-8000-000000000000", de 281474976710655 e 10 bytes 0xff resulta em "ffffffff-ffff-7fff-bfff-ffffffffffff" (RFC-004 §2)
- uuidV7 lança RangeError para random com comprimento 9 e 11 e para unixMs -1, 1.5 e 281474976710656 (RFC-004 §2, 48 bits de tempo e 74 bits aleatórios)
- newId deve corresponder à expressão regular /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ e duas chamadas devem produzir valores diferentes (RFC-004 §2)
- o tempo nos primeiros 12 dígitos hexadecimais de newId deve estar entre Date.now tomado imediatamente antes e imediatamente após a chamada (RFC-004 §2, ordenado por tempo)
- nunca edite apps/api/src/core/public/ids.ts
- Pode alterar: `apps/api/src/core/public/ids.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/api exec vitest run src/core/public/ids.test.ts`
  - `node scripts/check-test-quality.mjs apps/api/src/core/public/ids.test.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- as linhas de importação de done são as únicas importações do arquivo, cada nome nelas é utilizado e nada mais é importado
- uuidV7 recebe unixMs, um número simples de milissegundos, e random, um Uint8Array de exatamente 10 bytes, e retorna o texto UUID em minúsculas
- newId não recebe argumento e retorna uma string
- os bytes aleatórios do vetor RFC 9562 são 0x7c 0xc3 0x98 0xc4 0xdc 0x0c 0x0c 0x07 0x39 0x8f, escritos com Uint8Array.of
- os 10 bytes 0xff são um Uint8Array de comprimento 10 preenchido com 0xff, e os 10 bytes zero são um novo Uint8Array de comprimento 10
- os casos RangeError com um mau parâmetro random passando unixMs 0, e os casos com um mau parâmetro unixMs passando um novo Uint8Array de comprimento 10
- cada caso RangeError é uma própria expectativa sobre uma função que chama uuidV7, passada para toThrow com RangeError
- para a verificação de tempo, mantenha Date.now em um const antes da chamada e outro depois dela, remova o primeiro traço do id, leia seus primeiros 12 dígitos hexadecimais com parseInt base 16 e compare com toBeGreaterThanOrEqual e toBeLessThanOrEqual
- cada valor esperado é um literal escrito no teste, nunca construído com padStart ou com texto mais uma variável
- um describe para uuidV7 e outro para newId
- um write_file de todo o arquivo de teste, em seguida run_check 0, 1, 2 e 3

### E5-T02 — Implemente uuidV7 e newId e remova o stub

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E5-T01`
- Referências: [RFC-004 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [RFC-005 §1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- Ler antes: `apps/api/src/core/public/ids.ts`, `apps/api/vitest.config.ts`

**DoD (definição de pronto)**
- todos os testes em apps/api/src/core/public/ids.test.ts passam com 100% de cobertura de linha e ramo de ids.ts (run_check 0)
- ids.ts não possui a linha '// @stub E5-T02' e apps/api/vitest.config.ts não possui uma linha que exclua src/core/public/ids.ts
- uuidV7 lança RangeError quando unixMs não é um inteiro, está abaixo de 0 ou acima de 281474976710655, e quando random.length não é igual a 10
- newId fornece o uuidV7 baseado em Date.now e em 10 bytes provenientes de crypto.getRandomValues
- as assinaturas, os comentários /** */ e os tipos de parâmetro permanecem, enquanto os parâmetros perdem o sublinhado inicial
- ids.ts não recebe uma linha de importação
- Pode alterar: `apps/api/src/core/public/ids.ts`, `apps/api/vitest.config.ts`
- Testes protegidos: `apps/api/src/core/public/ids.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/core/public/ids.test.ts --coverage --coverage.include=src/core/public/ids.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- o único arquivo lido é apps/api/src/core/public/ids.ts, pois os passos estão nestas dicas
- o layout de bytes segue RFC 9562 §5.7 e o UUID v7 da RFC-004 §2, em 16 bytes
- os bytes de 0 a 5 contêm o tempo de 48 bits em big-endian, e os bytes de 6 a 15 contêm os 10 bytes aleatórios conforme chegam
- em seguida, os 4 bits superiores do byte 6 tornam-se 0111 (versão 7), e os 2 bits superiores do byte 8 tornam-se 10 (variante)
- <!--t:847e45da45-->keep the 16 bytes in a Uint8Array and read and write them through a DataView over its buffer, with setBigUint64 at offset 0 for the time shifted left by 16 bits as a BigInt, then set of the random at offset 6<!--/t-->
- altere os bytes 6 e 8 com getUint8 e setUint8, operadores de bit e com OR
- nunca leia um byte por índice, pois o tsconfig estrito pode torná-lo indefinido e sua guarda seria um ramo que nenhum teste alcança
- o texto é a sequência de 32 dígitos hexadecimais minúsculos, dois por byte com um zero à frente, dividido por traços em segmentos de 8, 4, 4, 4 e 12
- as duas guardas vêm primeiro: uma verifica as três condições de unixMs e outra verifica o comprimento, cada uma lançando um RangeError
- crypto é um global do Node, portanto newId não precisa de importação
- a linha de vitest.config.ts a ser removida é aquela dentro de coverage.exclude com src/core/public/ids.ts e o comentário stub E5-T02
- uma edição de arquivo em ids.ts que substitui os corpos das duas funções e remove a linha do esqueleto, uma edição de arquivo em apps/api/vitest.config.ts que remove a linha com o esqueleto E5-T02, em seguida execute run_check 0, 1 e 2

### E5-T03 — Escreva os testes para recordAudit

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [ADR-0006](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0006-registros-imutaveis-e-auditoria.md), [RFC-001 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md), [RFC-005 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- Ler antes: `apps/api/src/core/public/audit.ts`, `apps/api/src/people/infra/persons.test.ts`

**DoD (definição de pronto)**
- todos os testes falham atualmente contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import type { PGlite } from "@electric-sql/pglite";
- import type { PgliteDatabase } from "drizzle-orm/pglite";
- import { afterAll, beforeAll, describe, expect, it } from "vitest";
- import { migratedTestDb } from "../../db/test-db";
- import { recordAudit, type AuditEntry } from "./audit";
- recordAudit da entrada 1 resolve para serUndefined e a linha lida pelo SQL tem todas as colunas iguais ao campo da entrada (ADR-0006, who, when, before e after)
- recordAudit do registro de entrada 2 armazena actor_id, before e ip como nulo e as demais colunas iguais à entrada (RFC-005 §2, colunas nulas)
- após o sucesso do recordAudit da entrada 3, um segundo recordAudit da entrada 3 rejeita.toThrow, pois id é a chave primária (RFC-005 §2)
- nunca editar apps/api/src/core/public/audit.ts
- Pode alterar: `apps/api/src/core/public/audit.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/api exec vitest run src/core/public/audit.test.ts`
  - `node scripts/check-test-quality.mjs apps/api/src/core/public/audit.test.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- as linhas de importação de done são as únicas importações do arquivo, cada nome nelas é utilizado e nada mais é importado
- abra o banco de dados como feito em persons.test.ts, com let db e let client preenchidos antes de all via migratedTestDb e client fechado após all
- a entrada 1 tem id "01970000-0000-7000-8000-000000000001", actorType "ADMIN", actorId "01970000-0000-7000-8000-000000000002", action "example.updated", entityType "example"
- a entrada 1 também possui entityId "01970000-0000-7000-8000-000000000003", before { name: "Ana" }, after { name: "Ana Souza" }, na data de "2026-11-17T12:00:00.000Z" e ip "203.0.113.10"
- a entrada 2 tem id "01970000-0000-7000-8000-000000000004", actorType "SYSTEM", actorId null, action "example.created", entityType "example", entityId "01970000-0000-7000-8000-000000000005"
- a entrada 2 também possui before null, after { name: "Bia" }, na data de "2026-11-17T13:30:00.000Z" e ip null
- a entrada 3 é a entrada 1 espalhada com o id "01970000-0000-7000-8000-000000000006"
- cada entrada é uma const do tipo AuditEntry, com todos os campos escritos como literais
- a linha esperada de cada entrada é escrita como um objeto literal com os nomes de coluna em snake_case, nunca construída a partir da entrada
- o select é client.query de "select actor_type, actor_id, action, entity_type, entity_id, before, after, at, ip from core.audit_log where id = $1" com o id da entrada, e toEqual está em rows
- o tipo de linha do client.query é um tipo local com actor_type string, actor_id string ou null, action, entity_type e entity_id string, before e after unknown, at Date e ip string ou null
- um it por entrada, três it em um describe recordAudit
- um write_file de todo o arquivo de teste, em seguida run_check 0, 1, 2 e 3

### E5-T04 — Implemente recordAudit e remova o stub

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E5-T03`
- Referências: [ADR-0006](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0006-registros-imutaveis-e-auditoria.md), [RFC-001 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md), [RFC-005 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- Ler antes: `apps/api/src/core/public/audit.ts`, `apps/api/vitest.config.ts`

**DoD (definição de pronto)**
- todos os testes em apps/api/src/core/public/audit.test.ts passam com 100% de cobertura de linha e ramo de audit.ts (run_check 0)
- o arquivo audit.ts não possui a linha '// @stub E5-T04' e apps/api/vitest.config.ts não possui uma linha que exclua src/core/public/audit.ts
- import { auditLog } from "../infra/schema";
- recordAudit torna-se uma função assíncrona que aguarda o insert da entrada no auditLog, sem blocos if, try ou catch, fazendo com que um erro de banco de dados seja propagado sem tratamento
- os tipos ActorType e AuditEntry, os comentários /** */ e a assinatura permanecem, exceto pela adição do modificador async antes da palavra-chave function, e os parâmetros perdem o sublinhado inicial
- Pode alterar: `apps/api/src/core/public/audit.ts`, `apps/api/vitest.config.ts`
- Testes protegidos: `apps/api/src/core/public/audit.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/core/public/audit.test.ts --coverage --coverage.include=src/core/public/audit.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- o único arquivo lido é apps/api/src/core/public/audit.ts, pois os passos estão nestas dicas
- os campos de AuditEntry possuem os mesmos nomes das colunas de auditLog, portanto a entrada é passada diretamente como valores para db.insert sem mapeamento
- a linha de import da função done fica logo abaixo da linha de import do tipo drizzle-orm/pg-core, que permanece intacta
- a linha em vitest.config.ts a ser removida é aquela dentro de coverage.exclude contendo src/core/public/audit.ts e o comentário stub E5-T04
- um arquivo edit_file de audit.ts que adiciona a importação, substitui o corpo de recordAudit e remove a linha do esboço, um arquivo edit_file de apps/api/vitest.config.ts que remove a linha com o esboço E5-T04, em seguida execute run_check 0, 1 e 2

## Referências

- [RFC-004 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md)
- [RFC-005 §1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- [ADR-0006](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0006-registros-imutaveis-e-auditoria.md)
- [RFC-001 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md)
- [RFC-005 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- plano.md: [docs/plano/E5-F01/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F01/plano.md)
- revisao.md: [docs/plano/E5-F01/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F01/revisao.md)
- testes.md: [docs/plano/E5-F01/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F01/testes.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E5-T01`: done
- `E5-T02`: done
- `E5-T03`: done
- `E5-T04`: done

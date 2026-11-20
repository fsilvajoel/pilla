# [E4-F02] Redigite campos sensíveis dos logs

<!-- ada-feature:E4-F02 -->

> Entrega **E4** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E4-T03 (Bia): `apps/api/src/log/redact.test.ts`, os testes de `redact` e `REDACTED`.
- E4-T04 (Alice): `apps/api/src/log/redact.ts` sem recursão (C1, C2, C3, C7, C8), mantendo os comentários `/** */` do stub.
- E4-T05 (Alice): recursão em objetos e arrays (C4, C5, C6), com 100% de cobertura.
- Fora: ligar o `redact` no logger (cartão próprio) e qualquer outro arquivo.

## Regras e critérios

- A1: `redact` troca por `REDACTED` o valor de toda chave sensível, em qualquer profundidade.
- A2: chaves não sensíveis e valores que não são objeto simples saem iguais.
- A3: a entrada nunca é alterada.
- A4: todos os testes passam com 100% de linhas e ramos da implementação; typecheck e lint verdes.

## Contrato

_Sem contrato no plano._

## Cartões

### E4-T03 — Escreva testes para redigir

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [RFC-003 §4.1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-003-stack-tecnologica.md)
- Ler antes: `apps/api/src/log/redact.ts`

**DoD (definição de pronto)**
- todos os testes falham agora (o stub lança exceção) e passariam com uma implementação correta (run_check 0)
- import { REDACTED, redact } from "./redact";
- cada um dos campos cpf, phone, email, password e token tem seu valor substituído por REDACTED
- chaves que terminam com um nome sensível também são redigidas, ignorando o caso (accessToken, ownerCpf, userEmail, PASSWORD), enquanto outras chaves mantêm seu valor (name, amountCents, id)
- objetos aninhados e objetos dentro de arrays são redigidos em qualquer profundidade
- a entrada não é alterada; um objeto com um array aninhado incluído (compare-o com um structuredClone feito antes da chamada, nunca uma ida e volta via JSON)
- Date, um erro, uma string, um número e null são retornados como vieram (toBe)
- nunca edite apps/api/src/log/redact.ts
- Pode alterar: `apps/api/src/log/redact.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/api exec vitest run src/log/redact.test.ts`
  - `node scripts/check-test-quality.mjs apps/api/src/log/redact.test.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- uma chamada write_file do arquivo de teste inteiro, em seguida execute run_check 0, 1, 2 e 3
- use it.each para a lista de chaves sensíveis e construa objetos de entrada simples como { ownerCpf: "x", name: "Ana" }
- o valor esperado é sempre REDACTED ou o mesmo valor de entrada, nunca um valor computado no teste
- nunca escreva qualquer porque a lint se recusa, e compare o resultado inteiro com toEqual contra um literal de objeto simples, assim não há necessidade de cast ou acesso a propriedades

### E4-T04 — Implemente redact para objetos planos

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E4-T03`
- Referências: [RFC-003 §4.1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-003-stack-tecnologica.md)
- Ler antes: `apps/api/src/log/redact.ts`

**DoD (definição de pronto)**
- os testes dos cenários C1, C2, C3, C7 e C8 passam (run_check 0); C4, C5 e C6 são o próximo cartão
- um objeto simples recebe um novo objeto com as mesmas chaves, e o valor de cada chave sensível é REDACTED
- qualquer coisa que não seja um objeto simples é retornada como veio
- export function redact(value: unknown): unknown {
- export const REDACTED = "[REDACTED]";
- mantenha os comentários /** */ inalterados
- Pode alterar: `apps/api/src/log/redact.ts`
- Testes protegidos: `apps/api/src/log/redact.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/log/redact.test.ts -t "C[12378]:"`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- um objeto simples é aquele cujo protótipo é Object.prototype ou null (Object.getPrototypeOf)
- a regra para uma chave sensível está no comentário /** */ de redact, e uma pequena função auxiliar para ela mantém redact curto
- uma replace_function de redact (mais as funções auxiliares acima dela), em seguida run_check 0, 1 e 2

### E4-T05 — Faça com que o redact percorra recursivamente objetos e arrays aninhados

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E4-T04`
- Referências: [RFC-003 §4.1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-003-stack-tecnologica.md)
- Ler antes: `apps/api/src/log/redact.ts`

**DoD (definição de pronto)**
- todos os testes em apps/api/src/log/redact.test.ts passam com 100% de cobertura de linha e ramo de redact.ts (run_check 0)
- um array recebe um novo array com o redact aplicado a cada item
- o valor de uma chave que não é sensível também passa pelo redact, portanto objetos aninhados são redacionados em qualquer profundidade
- a entrada nunca é alterada
- mantenha os helpers, REDACTED e os comentários /** */ inalterados
- Pode alterar: `apps/api/src/log/redact.ts`
- Testes protegidos: `apps/api/src/log/redact.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/log/redact.test.ts --coverage --coverage.include=src/log/redact.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- altere apenas o corpo de redact com uma replace_function, em seguida execute run_check 0, 1 e 2

## Referências

- [RFC-003 §4.1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-003-stack-tecnologica.md)
- plano.md: [docs/plano/E4-F02/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F02/plano.md)
- testes.md: [docs/plano/E4-F02/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F02/testes.md)
- auditoria.md: [docs/plano/E4-F02/auditoria.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F02/auditoria.md)
- revisao-final.md: [docs/plano/E4-F02/revisao-final.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F02/revisao-final.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E4-T03`: done
- `E4-T04`: done
- `E4-T05`: done

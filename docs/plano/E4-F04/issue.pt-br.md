# [E4-F04] Redação de objetos com uma chave constructor própria

<!-- ada-feature:E4-F04 -->

> Entrega **E4** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E4-T08 (Bia): `apps/api/src/log/redact-prototype.test.ts`, arquivo novo só com o cenário do furo. Arquivo
  separado porque o `expect-red` exige que todos os testes do arquivo falhem contra o HEAD, e os testes da E4-F02
  já passam.
- E4-T09 (Alice): `apps/api/src/log/redact.ts`, o teste de objeto simples passa a usar o protótipo.
- Fora: qualquer outra mudança no redact ou nos testes da E4-F02.

## Regras e critérios

- A1: objeto literal com chave própria `constructor` é tratado como objeto simples e tem as chaves sensíveis redigidas.
- A2: instância de classe continua voltando como veio (C7 da E4-F02).
- A3: os testes da E4-F02 seguem verdes; 100% de linhas e ramos do `redact.ts`; typecheck e lint verdes.

## Contrato

_Sem contrato no plano._

## Cartões

### E4-T08 — Escrever o teste para um objeto simples com uma chave constructor

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [RFC-003 §4.1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-003-stack-tecnologica.md)
- Ler antes: `apps/api/src/log/redact.ts`, `apps/api/src/log/redact.test.ts`

**DoD (definição de pronto)**
- todos os testes falham agora contra a redação em HEAD e passariam com uma implementação correta (run_check 0)
- import { REDACTED, redact } from "./redact";
- um literal de objeto simples com uma chave própria chamada constructor (cenário C9 de docs/plano/E4-F04/plano.md) tem sua chave cpf substituída por REDACTED e mantém as chaves constructor e name
- o mesmo objeto aninhado dentro de outro objeto e dentro de um array também é redacionado
- nunca editar apps/api/src/log/redact.ts nem apps/api/src/log/redact.test.ts
- Pode alterar: `apps/api/src/log/redact-prototype.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/api exec vitest run src/log/redact-prototype.test.ts`
  - `node scripts/check-test-quality.mjs apps/api/src/log/redact-prototype.test.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- um write_file do arquivo de teste inteiro, em seguida run_check 0, 1, 2 e 3
- o valor esperado é sempre REDACTED ou o mesmo valor de entrada, nunca um valor computado no teste
- compare o resultado inteiro com toEqual contra um literal de objeto simples, para que não seja necessária nenhuma conversão de tipo nem acesso a propriedades

### E4-T09 — detecte objetos simples verificando o protótipo em redact

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E4-T08`
- Referências: [RFC-003 §4.1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-003-stack-tecnologica.md)
- Ler antes: `apps/api/src/log/redact.ts`, `apps/api/src/log/redact.test.ts`

**DoD (definição de pronto)**
- todos os testes em apps/api/src/log/redact.test.ts e apps/api/src/log/redact-prototype.test.ts passam com 100% de cobertura de linha e ramo de redact.ts (run_check 0)
- um objeto simples é aquele cujo protótipo é Object.prototype ou null, independentemente das chaves que ele possui
- mantenha REDACTED, a regra da chave sensível e os comentários /** */ inalterados
- Pode alterar: `apps/api/src/log/redact.ts`
- Testes protegidos: `apps/api/src/log/redact-prototype.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/log/redact.test.ts src/log/redact-prototype.test.ts --coverage --coverage.include=src/log/redact.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- a verificação de objeto simples em redact lê uma propriedade que pode ser substituída por uma chave própria, e a regra a seguir é a linha A1 de docs/plano/E4-F04/plano.md
- uma replace_function de redact, em seguida run_check 0, 1 e 2

## Referências

- [RFC-003 §4.1](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-003-stack-tecnologica.md)
- plano.md: [docs/plano/E4-F04/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F04/plano.md)
- testes.md: [docs/plano/E4-F04/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F04/testes.md)
- auditoria.md: [docs/plano/E4-F04/auditoria.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F04/auditoria.md)
- revisao-final.md: [docs/plano/E4-F04/revisao-final.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E4-F04/revisao-final.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E4-T08`: done
- `E4-T09`: done

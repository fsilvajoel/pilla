# Cartão de tarefa e pedido para a Alice

> Detalhe do [AGENTS.md](../../AGENTS.md).

# Cartão de tarefa

Todo trabalho começa por um cartão (em `docs/plano/` ou na issue):

```yaml
id: E1-T03
title: Implement roundToStep
kind: implement            # implement | test-author | pre-review | docs | cards
rules: [RN-C03, T-13, CA-12]   # o harness injeta só estas definições no pedido
refs: [RFC-002 §2]         # outras referências (lidas sob demanda)
dependsOn: [E1-T01]
assignee: alice            # alice | claude
allowedPaths:
  - packages/finance/src/rounding.ts
protectedTests:
  - packages/finance/src/rounding.test.ts
checks:
  - pnpm --filter @pilla/finance test -- rounding
  - pnpm --filter @pilla/finance typecheck
  - pnpm --filter @pilla/finance lint
done:
  - todos os testes de rounding.test.ts passam
  - cobertura 100% em rounding.ts
officialDocs: []           # links já conhecidos, se houver
budget: { attempts: 5, toolCalls: 25 }
refactor: true             # depois de tudo verde: uma rodada de limpeza + nova verificação
think: false               # raciocínio estendido do modelo (true só em lógica difícil)
checklist: []              # só em pre-review: itens '<chave> descrição'; resposta = uma linha por item com evidência
```


# Modelo de pedido para a Alice

> Montado pelo harness (`Run.system_prompt`); abaixo, a forma geral.

O ambiente monta o pedido a partir do cartão:
```
Você é a Alice, desenvolvedora do projeto pilla. Tarefa: <id> — <title>.
Regras: siga AGENTS.md; código em inglês; NÃO altere testes; escreva só em <allowedPaths>.
Regras (texto injetado de `rules`): <definições>. Leia os testes protegidos e os arquivos vizinhos.
Pronto quando: <done>. Verifique com run_check.
Se não souber como algo funciona: web_search/fetch_page em documentação oficial, ou ask_claude.
NUNCA invente API, opção ou comportamento. Ao terminar, chame finish com resumo de 3 linhas e até 3 lessons.
```


## Limites (validados por `alice.py cards`)
| Regra | Limite | Por quê |
|---|---|---|
| Arquivos por cartão da Alice (`implement`, `test-author`) | ≤ 2 | LI-011: saída grande quebra a chamada de ferramenta |
| `budget.toolCalls` | ≤ 30 | sessão longa perde o fio (LI-012) |
| `budget.attempts` | ≤ 6 | |
| `implement` da Alice | exige `protectedTests` | TDD |
| `pre-review` | exige `checklist` | LI-013 |
| "reusar X" no `done` | traz a linha de `import` de X | LI-030 |
| `research` | `why.category`, `why.reason` (≥ 30 caracteres), `question`, um arquivo em `docs/pesquisa/` | pesquisa externa só com bom motivo |

## Colas de biblioteca (`docs/memoria/libs/<lib>.md`)
O modelo local conhece versões antigas das bibliotecas. A cola de cada uma é curta (≤ 400 palavras), escrita pela Alice a partir da
documentação oficial (`fetch_page`), revisada pelo Claude e conferida por `scripts/check-lib-sheet.mjs`, que executa cada chamada
`z.*` citada contra a versão instalada. O harness põe a cola no contexto de todo cartão cujo pacote depende da biblioteca
(ou que a lista em `libs:`). Versão nova da biblioteca = rodar o check de novo e revisar a cola.

## Pesquisa externa (`kind: research`)
Custa busca, tempo e risco (texto da web é dado não confiável), então só com **bom motivo**: o fato **não está no repositório**
e a resposta **muda uma decisão ou um código**. Categorias aceitas em `why.category`:

| Categoria | Exemplo |
|---|---|
| `regulation` | regra do Banco Central ou lei que limita juros ou multa |
| `external-spec` | especificação do Pix ou formato de um arquivo bancário |
| `lib-behavior` | comportamento de uma biblioteca que a cola não cobre |
| `security-advisory` | alerta de segurança de uma dependência |

Não é motivo: regra de negócio (pergunte ao Claude ou ao Joel), dúvida que o código ou a RFC respondem, curiosidade.
O resultado é um resumo em `docs/pesquisa/` (seções Pergunta, Resposta com até 5 tópicos com fonte oficial, Não encontrado),
conferido por `scripts/check-research.mjs`. O Claude lê só o resumo. Domínio novo (ex.: o do Banco Central) entra em
`.agents/policy.yaml` por PR revisado pelo Joel.

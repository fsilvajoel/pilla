---
name: escrever-cartao
description: Como escrever um cartão de tarefa que um modelo local executa ao pé da letra (formato, pronto conferível, tamanho, orçamento). Use ao planejar ou revisar cartões antes de uma fila.
---

# Skill: escrever cartão de tarefa

## Propósito
O cartão é o pedido inteiro que o agente executor recebe. Ele não vê a conversa, não pergunta por hábito e segue o
texto ao pé da letra. **Cartão mal escrito vira falha de quem executa e retrabalho dos dois lados.** No histórico de
origem, metade das execuções que falharam teve como causa o cartão ou o processo de quem planejou, não o modelo.

## Contexto de uso
- Antes de pôr qualquer cartão na fila.
- Ao revisar o cartão de outro agente.
- Depois de uma falha: classificar a causa (cartão, harness ou modelo) antes de rodar de novo.

## Formato

```yaml
id: T-101
title: Add feature request validation to the public contract
kind: implement            # implement | test-author | pre-review | docs | cards | research
assignee: developer        # papel (agent/); test-author vai para o reviewer
rules: []                  # IDs de regra de negócio: só estas são injetadas no pedido
refs: [SPEC-014 §3]        # lidas sob demanda
dependsOn: [T-087]
allowedPaths:              # onde pode escrever (até 2 arquivos, sem curinga)
  - src/features/feature-request.ts
protectedTests:            # o teste que decide o pronto; o executor nunca altera
  - tests/feature-request.test.ts
generatedPaths: []         # opcional: arquivos que um check gera; o executor não escreve neles
readFirst:                 # tudo que precisa ler; arquivo citado no done tem de estar aqui
  - src/domain/contract.ts
  - src/common.ts
checks:                    # comandos sem shell, montados de `commands` do harness.project.yaml
  - <commands.test> tests/feature-request.test.ts -t featureRequest
  - <commands.typecheck>
  - <commands.lint> src/features/feature-request.ts
done:                      # o resultado, conferível; uma instrução por linha
  - all featureRequest tests in feature-request.test.ts pass (test filter -t)
  - 'fields, exactly: itemId: idSchema; quantity: positiveNumberSchema; createdAt: isoDateSchema'
  - export type FeatureRequest = z.infer<typeof featureRequest>;
  - 'import line: import { idSchema, isoDateSchema, positiveNumberSchema } from "../common"; never write a new regex'
hints:                     # como fazer; dica, não critério
  - keep the change to one narrow edit; the file should stay under 15 lines
budget: { attempts: 4, toolCalls: 20, minutes: 6 }
sizeNote: um contrato por cartão; o modelo deve seguir a interface já existente
```

Opcionais: `checklist` (só em `pre-review`), `libs`, `refactor` (padrão `true` em `implement`), `think`,
`maxOutputTokens`; em `research`, `question` e `why: { category, reason }`. Campo desconhecido reprova a validação.

## Passos recomendados

Coluna "Máquina": **V** = validação de cartões antes de qualquer execução; **P** = pré-voo da execução (antes de o
modelo gastar); **—** = só a leitura de quem escreve.

### 1. O pronto (`done`) e os `checks`

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 1 | Cada linha do `done` é um **resultado conferível** (teste que passa, nome exportado, valor exato). Técnica de edição vai em `hints`. | dica misturada com critério confunde o que decide o pronto | V |
| 2 | Tudo que o `done` pede e o teste não vê ganha um **check** que diz o que falta, ou uma **linha de código literal**. | critério sem trava de máquina é ignorado | — |
| 3 | Código literal no `done` vai **completo, terminado em `;`, sem texto no meio**. Assinatura de função vai em prosa. | o portão exige a linha exata até o primeiro `;` | V |
| 4 | Mudança em **mais de um lugar**: liste cada lugar e ponha um check que conte. | o modelo muda um lugar e os testes passam | — |
| 5 | Diga o **valor exato** (`amountCents: positiveCentsSchema`, não "amountCents > 0"). | descrição indireta obriga a adivinhar | — |
| 6 | "Reusar X" vem com a **linha de import** de X. | sem ela o modelo copia X | V |
| 7 | Todo arquivo citado no `done` está em `allowedPaths`, `protectedTests` ou `readFirst`, com o caminho. | o modelo não acha o arquivo sozinho | V |
| 8 | Regra de negócio citada no texto está em `rules`. | só o que está em `rules` é injetado | V |
| 9 | Cartão de código tem check de **teste, tipos e lint** (`commands.test`, `commands.typecheck`, `commands.lint`). | o lint é parte do pronto, não surpresa do commit | V |
| 10 | Check roda **sem shell** (nada de `\|`, `&&`, `>`), o comando existe e **explica a falha**. | "exit 1" mudo não orienta ninguém | V, P |
| 11 | Antes de começar, **algum check está vermelho**; depois de pronto, todos verdes. | se tudo já passa, nenhum check distingue pronto | P |
| 12 | Linha do `done` com até 220 caracteres e uma instrução só. | linha longa esconde a segunda instrução | V |

### 2. Tamanho e orçamento

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 13 | Até **2 arquivos listados**, **uma função** (ou até 3 triviais). A parte algorítmica difícil vem pronta e testada. | arquivo grande quebra a chamada de ferramenta; cartão grande roda 25 min e falha | V |
| 14 | `budget.toolCalls` ≥ 8 + 3 por check (e ≤ 30); `attempts` ≤ 6; `minutes` ≤ 15. | 5 checks consumiram 23 chamadas num orçamento de 20 | V |
| 15 | O esboço que o cartão manda preencher compila, sem tipo só declarado nem auxiliar que force ramo impossível. | esboço com defeito derrubou cartões inteiros | — |
| 16 | Arquivos de `readFirst` e `protectedTests` existem (ou um cartão anterior cria). | caminho errado custa chamadas até o modelo desistir | V, P |

### 3. Pré-revisão (`pre-review`)

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 17 | Sempre com `checklist` fechado, chaves únicas, um item por verificação. | revisão aberta devolve "sem achados" | V |
| 18 | Item **mecânico** (toda linha, nenhum uso de X) vira **check**, e o item cita o check e a regra (`run_check 2 (rule S1) proves it`). | o modelo não acha o mecânico lendo código | V |
| 19 | Para o modelo fica só o que exige leitura: nomes contra o glossário, sentido contra a especificação. | é onde ele rende | — |

### 4. Processo de quem planeja

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 20 | Antes da fila, a validação de cartões passa sem problemas. | regras viradas validação acharam 26 problemas em cartões antigos | V |
| 21 | Árvore limpa antes de executar e de retomar; ninguém edita o repositório enquanto o executor roda ou está pausado. | arquivo alheio vira "fora do escopo" na conta dele | P |
| 22 | Falhou? Classifique: **cartão**, **harness** ou **modelo**. Cartão e harness se corrigem com regra ou trava nova. | repetir sem corrigir a causa só gasta GPU e turnos | — |
| 23 | Lote novo começa por **um** cartão; o resto só depois de ele passar de primeira. | erro de molde se repete em todos os cartões do lote | — |

## O que o ambiente faz sozinho (não peça no cartão)
- Formata os arquivos tocados antes dos checks.
- Injeta a cola do lint e as colas de biblioteca dos arquivos do cartão (não repita "sem any" no `done`).
- Confere escopo, marcadores proibidos, frase de esboço restante, duplicação de 6+ linhas e diff vazio.

## Pesquisa externa (`kind: research`)
Regras e formato de saída na skill [pesquisa-web](../pesquisa-web/SKILL.md). O cartão traz `question` fechada e
`why: { category, reason }` (reason com 30+ caracteres).

## Regras comuns
Validar antes de concluir, escopo explícito e evidência acima de suposição: [policy/quality.md](../../policy/quality.md).

## Limitações
- As regras foram tiradas de execuções de um modelo de 9B com 64k de contexto; modelos maiores toleram cartões maiores.
- A validação (V) e o pré-voo (P) dependem do motor; sem ele, as regras valem como lista de leitura.

## Exemplos práticos
- Ruim: `done: - quantity must be positive`. Bom: `done: - 'fields, exactly: quantity: positiveNumberSchema'`.
- Ruim: `done: - reuse the id schema`. Bom: `done: - 'import line: import { idSchema } from "../common";'`.
- Ruim: `checks: - node -e "process.exit(ok?0:1)"`. Bom: um script que imprime "falta X em Y" e sai com 1.
- A forma correta é manter os exemplos genéricos; o repositório real fornece os nomes de módulo e contrato específicos do projeto.

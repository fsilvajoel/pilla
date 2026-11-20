# Bancada de modelos: análise (Claude, 2026-11-15)

Os números estão em [../bancada-modelos.md](../bancada-modelos.md), gerado a partir de `resultados.json`. Este texto é a leitura do Claude sobre eles, conferida execução por execução.

## O que a bancada mediu

O mesmo harness rodou quatro modelos locais, todos 100% na GPU de 12 GB e todos com contexto de 32k. Cada modelo fez 3 repetições de 4 cartões:
- 3 cartões de **implementação** (trocar o esboço `z.never()` pelo corpo real);
- 1 cartão de **pré-revisão**: um checklist de 7 itens, com 4 defeitos plantados pelo Claude.

A qualidade foi conferida fora do harness: testes de cada cartão, typecheck, `strictObject`, `export type` e nenhum esboço restante.

## Implementação: o harness nivela os modelos

- Nenhum cartão saiu sujo. Os 34 de 36 que o harness deu como prontos passaram na conferência do Claude. Os 2 restantes eram do gemma: o E2-T15 estourou o tempo e o harness o marcou como falho, sem esconder nada. O portão de ESBOÇO (LI-041) e o de `export type` (LI-042) seguraram todos os casos em que o modelo parou antes da hora.
- Os modelos diferem no **caminho**, não no resultado:

  | Modelo | Aprovados sem reprovação | Tempo por cartão |
  |---|---|---|
  | Qwen 3.8 27B (2 bits) | 9/9 | ~29 s |
  | Qwen 3.5 9B | 8/9 | ~29 s |
  | gemma | 2/9 | ~75 s |
  | gpt-oss | 2/9 | ~70 s |

  O gemma e o gpt-oss precisaram do retorno numerado do harness (LI-044) para fechar. Os Qwen acertam de primeira.
- **Velocidade de geração não é velocidade de entrega.** O gemma gera 2,7× mais tokens por segundo que o Qwen 3.8 e demora 2,6× mais por cartão, porque erra e refaz.

## Pré-revisão: o elo fraco é o checklist, e o harness mostrou onde

| Modelo | Pré-revisões done | Defeitos achados no arquivo certo (média, de 4) | Falsos positivos (total) |
|---|---|---|---|
| Qwen 3.5 9B | 2/3 | 2,3 | 1 |
| gemma | 3/3 | 1,7 | 0 |
| Qwen 3.8 27B | 1/3 | 1 | 0 |
| gpt-oss | 1/3 | 0 | 2 |

- O defeito **D3** (`z.number().int()`, coberto por um check do `check-avoid`) é o mais achado: 6 vezes no arquivo certo, em 12 pré-revisões (o D4, de regex, vem logo atrás: 5). Isso confirma a LI-035: o que é mecânico vai para script, e o modelo só lê o resultado.
- O defeito **D2** (um export faltando no `index.ts`) derrubou a maior parte das pré-revisões. 4 das 5 que falharam tinham dado "C5 ok" sem prova, e o portão de evidência (LI-026/LI-033) recusou. Ou seja, **o harness transformou um falso "tudo certo" em falha visível**. Sem ele, essas execuções teriam sido dadas como prontas com o defeito escondido.
- A brecha que sobrou (LI-050): o portão confere se a prova **existe**, não se ela **sustenta** o veredito. Três casos passaram:
  - "C5 ok — `index.ts:14-23`" (um intervalo de linhas não prova ausência);
  - "C3 ok" citando justamente a linha do defeito;
  - "C4 ok — `search_code 'new RegExp' -> 0`" (uma busca que não tem relação com o defeito).

  O gpt-oss, na repetição 2, passou assim com nota 1 de 7.

## Robustez: o que só apareceu porque trocamos de modelo

- **gpt-oss:** de vez em quando gera uma chamada de ferramenta que o Ollama não consegue ler, e o Ollama responde 500. Na 1ª rodada, 3 de 4 cartões caíram por isso. O harness agora repete a requisição em caso de 5xx (LI-049); nas rodadas seguintes, 2 erros 5xx aconteceram e foram absorvidos pela repetição, sem nenhum cartão perdido.
- **Travamentos** (a mesma chamada repetida várias vezes seguidas, LI-045): só o gemma (10). Os outros modelos não repetem chamadas.

## Conclusões

1. **Na implementação com portões de máquina, o harness é o que garante a qualidade.** Os quatro modelos entregaram código limpo, e o modelo só muda o custo: tempo e número de reprovações.
2. **O Qwen 3.5 9B é o melhor custo-benefício nesta GPU.** É o mais rápido por cartão (empatado com o Qwen 3.8), quase sem reprovação, e o melhor na pré-revisão. Ocupa 6,5 GB e deixa folga para o contexto.
3. **O Qwen 3.8 27B em 2 bits** implementa tão bem quanto o 3.5, mas na pré-revisão erra mais e é quase 2× mais lento por token.
4. **O gpt-oss não serve como revisor neste harness.** Não segue o formato do checklist (uma linha por item), falha 2 de 3 vezes e, quando passa, passa errado.
5. **O gemma é rápido por token, mas lento por cartão.** Ainda assim é o revisor mais "honesto": nenhum falso positivo, nunca deixou de fechar a pré-revisão, mas deixa passar o D2.

## Próximo passo sugerido (não aplicado; mudaria a bancada)

Aplicar a LI-035 aos itens que hoje dependem do modelo:
- um check que confira se todo `api/**.ts` tem export no `index.ts` (C5);
- um padrão no `check-avoid` para `regex(` fora de `common.ts` (C4);
- um padrão no `check-avoid` para `z.int().positive()` em vez de `positiveCentsSchema` (C3).

Com esses checks, a pré-revisão passa a depender do modelo só para ler o resultado, que é onde todos os quatro acertam.

## Limites desta bancada

- São 3 repetições por modelo: dá para comparar tendências, não para afirmar diferença estatística.
- É uma tarefa só (esquemas zod de um pacote) e um checklist só.
- A rodada 1 do gemma e dos dois Qwen rodou no harness `a984aec`; o resto, no `5286a25`, que acrescenta só a repetição em caso de 5xx. Esses três modelos tiveram 0 erros 5xx, então o caminho alterado não foi usado por eles (`harnessRev` está em cada linha de `resultados.json`).

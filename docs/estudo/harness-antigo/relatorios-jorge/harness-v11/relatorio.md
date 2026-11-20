# harness-v11 — raiz do quadro e stubs de cartões

## Identificação

- **Versão:** harness-v11
- **Data:** 2026-11-16T23:46:16-03:00 (informada; relógio não aferido)
- **Execução:** Review harness-v11; ID adicional não fornecido.
- **Estado da versão:** proposta.
- **Escopo recebido:** quadro sem `--repo` escreve dentro do harness; decidir destino git da fotografia; E6 bloqueada pelo hook ao tentar commitar stubs E6-T02/T04/T06 com plano existente; nenhum cartão rodou. Análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas, teto 3000 créditos.
- **Fontes recebidas:** duas anotações da caixa de entrada em 2026-11-16T23:25:33 e 23:45:47-03:00; `tools/jorge/logs/harness-v10/relatorio.md:110-137`; `docs/plano/E6.yaml:1-211` e `docs/plano/E6-F01/plano.md:9-21` apenas como evidência; nenhuma retro indicada.
- **Base git:** `c708e36b997682b579e4a3ffb635dd1e6b3da4a2` (`docs/mvp-planning`); worktree `jorge/harness-v11` informado.
- **Workspace inicial:** isolado informado; limpeza não aferível pelas ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado, metadados efetivos da API indisponíveis na análise.
- **Autorizações de Joel:** pedidos nas anotações recebidas; não há autorização de afrouxamento indiscriminado de `Card-Done`. Trava delimitada aos stubs com teste, sujeita à auditoria do Joel.
- **Suíte de referência:** VERDE, 252 testes (`python3 -m unittest discover -s tests` em `tools/alice-harness`), fornecida pelo runner; contagens de ignorados não fornecidas.

## Diagnóstico

### Fatos confirmados
- `alice.py:1502-1516` usa `Path('.')` para os três comandos, resolve relativamente ao cwd e `quadro.py:13-14,51-54,124-146` grava sob esse caminho; quando cwd é o harness cria `tools/alice-harness/docs/agents/` em vez de `docs/agents/` na raiz. `tests/test_quadro.py:22-27,99-104` só testa `--repo` explícito. `harness-v10/relatorio.md:43` havia previsto expressamente default `.`; a anotação v11 corrige a intenção.
- A raiz `.gitignore:20-22` **já ignora** `docs/agents/quadro.md` e `docs/agents/quadro-entradas.json`; o `.gitignore` interno (`tools/alice-harness/.gitignore:1-6`) não ignora saídas geradas no caminho errado. A anotação de arquivos untracked corresponde ao problema de cwd; não há justificativa para editar a raiz `.gitignore` (também fora da lista de escrita).
- `scripts/guard_hook.py:70-76,100-115` lê planos existentes, associa `allowedPaths` de cartões Alice abertos ao índice, exige `Card-Done` inclusive para stubs preparatórios e só valida revisão para test-author. `docs/plano/E6.yaml:41-50,112-120,179-187` liga os três stubs aos implements da Alice; `E6-F01/plano.md:19-21` requer stub em HEAD para expect-red. O bloqueio da tentativa de commit foi relatado na anotação, não reproduzido por execução do hook.
- `scripts/guard_hook.py:94-96,113-115` também bloqueia etiqueta de exclusão `stub <ID>` apenas quando há trailer Done; esse bloqueio não deve ser removido para entrega final. `feature.py:434-445` usa HEAD como stub durante a feature. `metricas(metrics)` dá 29 runs, 18 done, 1,97 tentativas e 196,5 s médios históricos; `metricas(evolution)` não tem execução da leva E6, portanto não quantifica economia desta correção.

### Causas e hipóteses
- **Confirmada:** default `.` errado para CLI de quadro; regra de commit agrupa preparação limitada e entrega final sem estado intermediário, apesar do plano precisar de stub em HEAD.
- **Não confirmada:** conteúdo exato do índice recusado e formatos de stubs E6 não foram inspecionados/reproduzidos nesta análise; a expressão “assinatura mais erro not implemented” não define sozinha o que fazer com imports, declarações de tipos, interfaces e comentários. Definir predicado conservador testável; não certificar stubs reais nem dispensar revisão de test-author.

### Justificativa econômica
- Quadro: defeito observado numa leva, correção de default com teste e custo local pequeno; evita fotografia em lugar errado sem chamadas adicionais à API além da consulta já existente ao gerar. `.gitignore` já resolve a escolha, nenhuma mudança econômica justificada ali.
- Stubs: uma tentativa bloqueada e nenhum cartão rodado; sem caminho seguro, preparação da E6 fica impedida. Custo de testar parser conservador e hook é limitado; risco de autorizar solução disfarçada exige falha fechada e auditoria de trava. Economia de créditos e tempo da futura leva é hipótese, não medida.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV11-1 | CLI de fotografia grava na pasta errada quando invocada do harness | anotação 23:25:33; `alice.py:1502-1516`, `quadro.py:13-14`, `tests/test_quadro.py:99-104` | default dos três `--repo` obtido da raiz git do checkout, sem alterar opção explícita | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_quadro.py` | cwd no harness: `leva`, `fila`, `quadro` direcionam à raiz git (mock de escritores sem rede); `--repo` explícito prevalece; falha ao descobrir raiz não grava no cwd | baixo — resolução de repo | correção | adiada — aguardando aplicação |
| JV11-2 | guard_hook nega commit preparatório de stub com plano já presente | anotação 23:45:47; `scripts/guard_hook.py:100-115`; `docs/plano/E6.yaml:41-50,112-120,179-187`; `feature.py:434-445` | aceitar `Card-Stub: <ID>` **somente** para arquivo staged novo de implement Alice, corpo comprovadamente placeholder; qualquer outra alteração exige Done; conservar revisão e proteção de etiqueta no Done | `tools/alice-harness/scripts/guard_hook.py`, `tools/alice-harness/tests/test_guard_hook.py` (novo) | fixture git com plano: antes bloqueia stub legítimo, depois aceita; arquivo com lógica, alteração existente, ID errado e test-author seguem negados; entrega Done continua checando etiquetas | médio — afrouxamento estritamente condicionado de trava de commit | trava | adiada — aguardando aplicação |
| JV11-3 | proposta de adicionar regra `.gitignore` no harness/raiz | anotação 23:25:33; `.gitignore:20-22` | nenhuma: ignore da raiz já existe, não versionar nem duplicar | nenhum | inspeção da regra existente; teste JV11-1 cobre destino correto | baixo; mudança redundante | simplificação | recusada — já atendida |

### JV11-1 — default git para fotografia

- **Causa e comportamento atual:** `Path('.')` resolve no diretório atual mesmo quando ali não está a raiz; `quadro.generate` concatena os caminhos relativos ao repo recebido.
- **Comportamento pretendido:** sem `--repo`, os três comandos resolvem o top-level do checkout via `git rev-parse --show-toplevel`; com `--repo`, manter resolução explícita sem git. Descoberta inválida/falha deve encerrar sem criar saída espúria.
- **Implementação mínima:** mudar apenas defaults dos três parsers para ausência explícita e, no ramo compartilhado, resolver raiz git ou `ns.repo`; nenhuma alteração nos caminhos de `quadro.py`.
- **Fora do escopo:** mudar defaults de `run`, `feature`, `cost` ou outros comandos; atualizar automaticamente o quadro; modificar `.gitignore` da raiz (proibido e redundante).
- **Dependências e ordem:** nenhuma; executar antes de JV11-2.
- **Prova de regressão:** teste com cwd de harness e `--repo` omitido, `subprocess.run`/`check_output` isolado e callbacks de quadro mockados: o default anterior falha por apontar cwd, novo aponta à raiz; verificar os três comandos e `--repo` explícito. Caso negativo: git inexistente/fora de checkout não escreve nem produz quadro na pasta errada.
- **Casos negativos/limites:** `0/0` continua reprovado por `tests/test_test_guardrails.py:27-40`; mock de `generate` evita API Bia; caminho explícito temporário continua permitido.
- **Compatibilidade:** CLI mantém sintaxe, altera apenas destino default dos três comandos para raiz; config nenhuma; consumidores humanos passam a encontrar saída em `docs/agents/` da raiz, já ignorada; migração: descartar fotografia equivocada não versionada sob o harness, sem editá-la no Review. Custo esperado: uma chamada local ao git quando `--repo` ausente, sem novo pedido Bia.
- **Auditoria:** não aplicável. **Autorização:** anotação recebida. **Custo/benefício esperado:** baixo esforço, evita arquivo órfão; economia não mensurada. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando aplicação.

### JV11-2 — trailer de preparação com verificação do índice

- **Causa e comportamento atual:** `commit_problems` só conhece Done e não distingue um novo placeholder de uma implementação; hook recusa stubs criados após o plano.
- **Comportamento pretendido:** `Card-Stub: <ID>` autoriza somente os arquivos novos e staged que correspondam a `allowedPaths` de **implement da Alice** ainda aberto, que não existam em HEAD e sejam sintaticamente stubs verificáveis (assinatura, tipos/imports/comentários necessários e corpo `throw new Error('not implemented')`, sem lógica nem outros efeitos). Qualquer arquivo/trecho não comprovado continua requerendo Done. Stub não marca cartão done nem equivale à entrega final. `Card-Done` permanece responsável por remover `stub <ID>` e garantir revisões de test-author. Não alterar hooks de escrita/leitura/execução, orçamento ou policy.
- **Implementação mínima:** validar conteúdo efetivamente staged via `git show :<path>` com falha fechada em erro, e existência em HEAD via git; limitar a arquivos TS/TSX de código esperados pelo plano e placeholder estrito, recusando conteúdo não reconhecido ou `Card-Stub` sem arquivo staged válido; trailer identificado por linha completa em comando (não substring de outro ID). Não aceitar alteração preexistente ou `test-author`; se a estrutura real dos stubs exigir parser/heurística permissiva não testável, parar JV11-2 e relatar impedimento, sem liberar por nome ou trailer apenas. Garantir também que commit misto com `Card-Stub` e arquivo não stub no mesmo cartão falhe.
- **Fora do escopo:** editar/criar stubs em `apps/**`, plano em `docs/plano/**`, executar cartão ou produto, alterar `feature.py`/expect-red ou permitir entregas sem revisão.
- **Dependências e ordem:** após JV11-1; sem dependência funcional.
- **Prova de regressão:** novo teste de hook com git temporário, YAML de plano para Alice e chamadas a `commit_problems`, ajustando somente `REPO` do módulo: índice contém stub novo mínimo e `Card-Stub: E6-T02` → antes falha, depois lista vazia; contraprovas para `return`/cálculo/efeito adicional, arquivo modificado já em HEAD, ID inexistente/errado, ausência de trailer, test-author com Stub, segundo arquivo de implementação no mesmo commit, e etiqueta `stub <ID>` ainda staged no Done. Verificar que `done_ids` não conta `Card-Stub`. Nenhuma rede ou produto executado; suíte inteira ≥252 e 0/0 não produz verde.
- **Casos negativos/limites:** conteúdo malformado, blob indisponível, arquivo renomeado/preexistente, texto com `not implemented` em comentário ou branch com implementação devem falhar fechados; nenhum teste de revisão é omitido. Se o predicado seguro não admitir a estrutura necessária à E6, registrar limitação sem ampliar autorização.
- **Compatibilidade:** novo trailer opcional na CLI de git commit, sem mudar os commits `Card-Done` válidos; nenhuma configuração; consumidores são Claude/hook e feature que lê HEAD; custo esperado poucos processos git e validação local por commit; evita bloqueio relatado, economia de modelo não quantificada.
- **Auditoria:** **trava — auditoria do Joel**, commit separado `Trava: sim` pelo runner. **Autorização:** pedido de escopo propõe Card-Stub sob condição mecânica, sem autorização para liberar outros casos. **Custo/benefício esperado:** alto impacto potencial (leva bloqueada) contra risco de bypass, que o teste negativo deve conter. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando aplicação; se impossível provar fronteira segura, adiar e pedir decisão objetiva em vez de alargar.

### JV11-3 — ignore redundante

- **Causa e comportamento atual:** anotação registrou fotografia untracked; código aponta cwd errado; a raiz já ignora os dois destinos pretendidos.
- **Comportamento pretendido/implementação mínima:** não fazer mudança; verificar default de JV11-1 em vez de duplicar ignore.
- **Fora do escopo:** alterar `.gitignore` raiz (fora da lista de escrita), versionar fotografia operacional.
- **Dependências e ordem:** nenhuma.
- **Prova de regressão/casos negativos:** `JV11-1` cobre saída correta; regra existente em `.gitignore:20-22` basta; não usar arquivo temporário como snapshot autoritativo. Cobertura `0/0` permanece negada.
- **Compatibilidade:** CLI/config/consumidores inalterados por este item; custo adicional nenhum.
- **Auditoria:** não aplicável. **Autorização:** não necessária para não alterar. **Custo/benefício esperado:** evita manutenção e alterações redundantes. **Resultado observado:** nenhuma mudança pretendida. **Motivo do status:** recusada — regra já existente.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Nenhuma neste momento | — | O pedido explicita exceção restrita a stub; o ignore já existe | Implementar só com prova mecânica; se não for possível, adiar JV11-2 e consultar Joel | Não |

Mudanças necessárias fora da lista de escrita: nenhuma nesta proposta. Stubs em `apps/**`, plano `docs/plano/**` e `.gitignore` raiz não serão editados pelo Jorge.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 252 | 0 (inferido de VERDE) | 0 (inferido de VERDE) | não informado | pedido do runner |
| Regressão antes da correção | JV11-1/JV11-2 | não executada, análise somente leitura | — | — | — | — | análise |
| Após evolução | — | pendente | — | — | — | — | aplicação |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; 0 testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma executada nesta análise.
- **Desvios do relatório inicial:** nenhum até aqui.
- **Resultado transacional:** pendente do runner. **Commit:** pendente do runner.
- **Se não aplicado:** registrar motivo e referência ao diff preservado pelo runner.
- **Evoluções revertidas:** nenhuma nesta fase.

## Custo da execução do Jorge

Dados da API/runner ainda não fornecidos; não presumir consumo pelo nome do modelo nem estimar preços sem tabela.

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | sem dupla contagem; runner |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | runner informará inclusão na saída |
| Custo monetário | indisponível | runner/preços |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta análise | runner |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial, aguardando runner.
- **Estimativas separadas dos valores medidos:** somente avaliação qualitativa: git local para defaults e verificação por commit; sem preço inventado.
- **Consumo de Bia:** nenhum pelo Review; testes propostos sem rede.
- **Conclusão:** corrigir cwd e desbloquear somente stubs comprovados oferece benefício potencial, mas não declarar economia realizada sem medição; recusar alteração `.gitignore` redundante.

---
## Verificação do runner
- Status: **aplicada**
- Base: `c708e36b997682b579e4a3ffb635dd1e6b3da4a2`
- Suíte final: VERDE, 258 testes (referência 252)
- Arquivos alterados: tools/alice-harness/alice.py, tools/alice-harness/scripts/guard_hook.py, tools/alice-harness/tests/test_quadro.py, tools/alice-harness/tests/test_guard_hook.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): tools/alice-harness/scripts/guard_hook.py
- Problemas: nenhum

## Resumo do finish
IDs candidatos implementados: JV11-1 (leva/fila/quadro sem --repo usam git rev-parse --show-toplevel; --repo explícito preservado; falha de descoberta não escreve), JV11-2 (trava: Card-Stub somente para novo TS/TSX de implement Alice staged, com funções cujo único corpo lança Error('not implemented'); Card-Done e revisão continuam exigidos para entrega). JV11-3 recusada: .gitignore da raiz já ignora os dois destinos corretos; não foi alterado. Arquivos alterados: tools/alice-harness/alice.py, tools/alice-harness/tests/test_quadro.py, tools/alice-harness/scripts/guard_hook.py (trava para auditoria do Joel), tools/alice-harness/tests/test_guard_hook.py. Suíte referência 252 verde; regressão JV11-1 antes 254 vermelho (2 falhas), depois 254 verde; regressão JV11-2 antes 258 vermelho (1 falha), após implementação primeira execução 258 vermelho (1 falha) e após ajuste do reconhecimento de comentários 258 verde. Testes sem rede nem consumo de Bia; cobertura 0/0 permanece reprovada pelo teste existente. Desvio/limitação: o reconhecedor deliberadamente restrito não prova aceitação dos stubs E6 reais (proibido ler/editar apps durante aplicação de produto; não houve execução de E6), e recusa estruturas TS/TSX não contempladas, em vez de liberar código incerto; Joel poderá avaliar se formatos reais exigem ampliação testada. Nenhuma pergunta ao Joel. Não houve commit por Jorge; confirmação final, separação da trava e integração dependem do runner.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 24 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 228837 |
| Entrada em cache | 1086863 |
| Tokens de saída | 9501 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 1105.27 |
| Passos análise / aplicação | 4 / 20 |
| Suítes rodadas | 5 |
| Início / fim | 2026-11-16T23:46:16-03:00 / 2026-11-16T23:48:06-03:00 |

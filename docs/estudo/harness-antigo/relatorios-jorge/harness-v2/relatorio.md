# harness-v2 — portões TDD e orçamento da Bia

## Identificação

- **Versão:** harness-v2
- **Data:** 2026-11-16T14:37:04-03:00 (recebida; conclusão a cargo do runner)
- **Execução:** Review harness-v2; ID do runner não fornecido.
- **Estado da versão:** proposta
- **Escopo recebido:** pendências do harness-v1, I–L orçamento da Bia e avaliação de gatilho Jorge ao fim da feature; 40 passos análise, 60 aplicação, leitura até 400 linhas, teto 3000 créditos.
- **Fontes recebidas:** caixa de entrada; `tools/jorge/logs/harness-v1/relatorio.md`; `tools/alice-harness/runs/retro-20261116-102951.md` e `retro-20261116-102615.md`; código e testes indicados abaixo.
- **Base git:** `07f5ea0c897d24906137b77f301ca6e5b8e7fbad` (recebida; SHA não aferido independentemente).
- **Workspace inicial:** worktree isolado `jorge/harness-v2` informado; limpeza não verificável pelas ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** metadados da API indisponíveis; `gpt-6-sol` é nome recebido, não prova do provedor.
- **Autorizações de Joel:** novas regras do núcleo permitem travas com teste e commit separado; autorização de liberação extraordinária I–L ainda pendente.
- **Suíte de referência:** VERDE, 231 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, recebida do runner para este Review; falhas/erros/ignorados não discriminados. Nenhuma suíte executada na análise.

## Diagnóstico

### Fatos confirmados

- `alice.py:192-200` retorna o código puro do comando; `bia.py:128-129,309,519`, `feature.py:298-303,321,331,412-415,438,506-519` e `alice.py:715-723` compartilham esse resultado diretamente ou por `bia.run_checks`. Incidente relatado na caixa: vitest `Unknown% (0/0)` com exit 0; as duas retros não contêm a saída bruta. Cobertura sem medição pode passar como verde. `gates.py` não possui validador de cobertura.
- `feature.py:321,331` verifica os testes no worktree atual; `feature.py:265-269` lê o stub do HEAD para o prompt, e `feature.py:382-395` usa isolamento incompleto apenas no complemento. A retro `retro-20261116-102951.md:26-33` mostra 4/4 requisições gastas e `retro-20261116-102615.md:22-27` mostra 3/6; não demonstra que as chamadas extras foram exclusivamente causadas pela implementação prévia.
- `cards.py:393,443-445` aceita orçamento 2–6 e `feature.py:204-224` confia em plano e `estado.json` editáveis para limitar chamadas; `bia.py:88-113` pode repetir a chamada de rede até três vezes dentro de uma única contagem do orquestrador. `feature.py:181-190` grava estado em `docs/plano/**`, caminho intocável neste Review. Uma liberação no mesmo worktree é falsificável.
- `feature.py:195-199` atualiza extras sem limpar chaves anteriores; `alice.py:1373-1389,1456` exige diretório, não ID, no resume; `feature.py:525-531,556-570` já produz resumo Bia/Alice, mas não aferição automática de Claude. `alice.py:1352-1354` não commita entre cartões. `.env.example:1-11` não lista Abacus; `bia.py:77-85` consome exclusivamente `OPEN_ROUTER_API_KEY`, portanto adicionar Abacus como se fosse a chave da Bia induziria erro.
- `tools/jorge/nucleo/runner.py:483-494,540-558` já detecta features por estado e a caixa de entrada; o timer é horário (`tools/jorge/nucleo/systemd/jorge-auto.timer`). O v1 não alterou arquivos: relatório `:153-163` documenta recusa anterior de escrita de teste para JV1-2; o núcleo agora classifica checks comuns como correção.
- `metricas(metrics)` informa 28 runs, 17 done (60,7%), ~201,2 s médios, ~1,96 tentativas; `metricas(evolution)` separa versões e execuções, sem antes/depois de correções v2. Sem métricas de custo Bia por causa específica.

### Causas e hipóteses

- **Confirmada:** código permite cobertura vazia com exit 0; testes da etapa tests rodam contra implementação prévia; `with_stub` usa `git checkout HEAD --` (altera índice) e não restaura paths inexistentes em HEAD; orçamento baseado em estado/plano e contagem antes de `bia.chat` não constitui autoridade independente por tentativa de rede.
- **Não confirmada:** formato completo de cobertura vitest em produção, quantas chamadas foram desperdício, erro aritmético real da cota OpenRouter, quantidade de tokens omitidos em respostas sem `choices`/falha e regra desejada para commits/migrações. `0/0` nas retros refere-se a tokens Bia nas rodadas da Alice, não prova perda de medição da Bia.

### Justificativa econômica

- Rejeitar `0/0` evita aprovação falsa de testes; implementação e teste isolado custam pouco por chamada, impacto alto mesmo com um incidente relatado. Testar contra stub evita um reparo indevido potencial, não é economia comprovada; exige regressões git para não destruir alterações. O orçamento I–L merece prioridade de integridade, mas prometer ledger append-only dentro do worktree produziria falsa segurança: separar trava verificável de autoridade externa indefinida. Itens sem causalidade ou com gatilho existente não justificam API/retrabalho agora. Benefício econômico ainda estimado, nunca realizado.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV2-1 | Cobertura 0/0 dá verde | incidente da caixa; `alice.py:192-200`, `bia.py:128-129` | fazer check de cobertura retornar não zero com total 0 comprovado, sem mudar comandos normais | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_test_guardrails.py` | exit 0 e `Unknown% (0/0)` vira falha; cobertura positiva e comandos comuns não mudam | médio: formatos de saída e falsos positivos | correção | adiada — aguardando aplicação |
| JV2-2 | Etapa tests testa implementação anterior, e isolamento existente altera índice | `feature.py:321,331,382-395`; retros indicadas | executar os dois lotes sob stub do HEAD com restauração de worktree e índice, falhar fechado em erro de preparação | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | fixture git: impl prévia não provoca reparo, índice e worktree preservados; erro git não aprova | médio/alto: operação git transitória | correção | adiada — aguardando aplicação, condicionada à prova de restauração |
| JV2-3 | Orçamento e liberação forjáveis; I–L incompletos | `cards.py:393,443-445`, `feature.py:181-224`, `bia.py:88-113` | projetar ledger autoritativo fora do worktree, débito atômico por tentativa e liberação autenticada de Joel; não aplicar proteção parcial | futuros: `tools/alice-harness/{cards,feature,bia}.py`, testes; autoridade externa/núcleo **fora da escrita**, apenas proposta | falsificar estado/plano/liberação não concede chamada; retries contabilizados; falha de persistência bloqueia | alto: limite financeiro e autoridade | trava | adiada — aguardando Joel |
| JV2-4 | `finish` mantém `red/message` obsoletos no estado | `feature.py:195-199`, `stage_tests:317-339`; relato JV1-4 | substituir somente campos efêmeros `message` e `red` a cada conclusão de etapa; manter contadores/dados históricos necessários | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | tentativa vermelha seguida de done remove erro antigo; ainda vermelho conserva motivo e contadores | baixo/médio: consumidores do estado | correção | adiada — aguardando aplicação |
| JV2-5 | Resume exige diretório, não ID | `alice.py:1373-1389,1456`; JV1-4 | não mudar sem semântica de busca e desambiguação, nem reprodução de custo | nenhum nesta versão | a especificar: ID único resolve; ID duplicado/ausente recusa; caminho continua válido | médio | correção | adiada — falta especificação/repro |
| JV2-6 | Cota/tokens Bia, relatório de tokens, exemplo Abacus e commits entre cartões | `bia.py:62-74,88-113`, `feature.py:525-531`, `alice.py:1352-1354`, `.env.example:1-11`; retros | não alterar sem resposta bruta/semântica de métrica e sem uso real de `ABACUSAI_API_KEY`; manter plan-run sem commit | nenhum nesta versão | fixture de erro com usage/cota real e exigência de relatório antes de propor; commit requer requisito | médio | métrica/doc | adiada — falta evidência; commit intermediário recusado por contrariar fluxo vigente |
| JV2-7 | Proposta de chamar Jorge no fim da feature | `feature.py:573-583`, `runner.py:483-494,540-558` | não criar invocação recursiva/race; timer já varre estado | nenhum | nenhum: sem falha nova comprovada | médio: duplicidade/concorrência | simplificação | recusada — ganho não demonstrado |

### JV2-1 — cobertura não vazia é condição de verde
- **Causa e comportamento atual:** `run_cmd` aceita exit 0 com tabela vazia; todos os checks de Bia/feature e `Run.check` compartilham a função.
- **Comportamento pretendido:** saída que comprove total `0/0` do check de cobertura (`--coverage`) reprova independentemente do exit; preservar falhas existentes e checks não cobertura. Se não houver forma confiável de distinguir total zero de trechos irrelevantes, interromper a evolução em vez de supor cobertura positiva.
- **Implementação mínima:** reconhecimento estreito de tabela/indicador global `Unknown% (0/0)` na saída do comando de cobertura, devolvendo erro legível; sem alterar comandos de produto.
- **Fora do escopo:** configurações vitest e garantia genérica de cobertura positiva quando a saída não fornece dados verificáveis.
- **Dependências e ordem:** nenhuma; primeira correção.
- **Prova de regressão:** mock de subprocess em `test_test_guardrails.py` comprova falha antes e passe depois; casos positivos exit 0 com cobertura real, outros comandos e exit não zero.
- **Casos negativos/limites:** `0/0` de teste que não é cobertura não causa falha; tabela com arquivos efetivos não é reprovada; total vazio nunca verde.
- **Compatibilidade:** CLI/config inalteradas; consumidores `bia.run_checks`, `feature`, `Run.check` receberão erro adicional quando cobertura vazia; inspeção de texto custo desprezível, estimado.
- **Auditoria:** não aplicável; portão de cobertura não é trava segundo núcleo v2.
- **Autorização:** escopo do Review.
- **Custo/benefício esperado:** alta integridade, ganho monetário não mensurado.
- **Resultado observado:** só análise.
- **Motivo do status:** aguardando aplicação.

### JV2-2 — testes contra stub com restauração transacional
- **Causa e comportamento atual:** dois `test_checks()` da etapa tests veem implementação do worktree; `with_stub` não preserva staged state nem arquivo sem HEAD.
- **Comportamento pretendido:** ambos os lotes de checks operam com stub do HEAD, mantendo conteúdo, existência, modo e índice dos paths da implementação intactos após sucesso/falha.
- **Implementação mínima:** contexto específico da etapa tests: preparar snapshots de índice e worktree dos paths antes de mudar arquivos; usar conteúdo do HEAD no worktree sem `git checkout` que altere índice; restaurar no `finally`, inclusive arquivos não existentes em HEAD; abortar antes de checks ao falhar preparação. Não alterar `with_stub` do complemento sem regressão dedicada.
- **Fora do escopo:** produto, alterações em `docs/plano/**` deste Review (somente fixtures em tmp nos testes), mudança do stub ou da auditoria.
- **Dependências e ordem:** após JV2-1 por prioridade, funcionalmente independente. Se não houver restauração segura verificável, parar apenas JV2-2.
- **Prova de regressão:** fixture git com HEAD stub, worktree impl anterior, índice staged diferente do worktree; lote 1 passa sem reparo e ambos são repostos exatamente; fixture com teste bad dispara reparo/lote 2 ainda sob stub; falha na preparação não aprova nem perde alterações; mock de exceção em checks restaura.
- **Casos negativos/limites:** impl novo sem HEAD, index staged e arquivo removido; nenhum estado falso `done` após falha git.
- **Compatibilidade:** CLI/config inalteradas; `stage_tests` e usuários de feature veem expect-red correto; custo de git/I/O pequeno, economia de requisições apenas hipótese.
- **Auditoria:** não aplicável (portão TDD é correção).
- **Autorização:** escopo do Review; nova classificação expressa do núcleo, apesar da recusa v1.
- **Custo/benefício esperado:** menos reparos Bia possíveis, não quantificados.
- **Resultado observado:** só análise.
- **Motivo do status:** aguardando aplicação condicionada à prova transacional.

### JV2-3 — governança I–L sem autoridade forjável
- **Causa e comportamento atual:** plano e estado são editáveis; `bia.chat` faz retries sem débito individual. O runner v2 protege apenas alterações feitas neste Review; não fornece ledger de produção nem validação da identidade de Joel para desbloqueio.
- **Comportamento pretendido:** I livro-caixa append-only com autoridade independente e débito atômico antes de cada tentativa real; J `biaBudget` ≤3 validado; K parada firme; L liberação extraordinária autenticada pelo Joel, nunca por arquivo alterável por agente.
- **Implementação mínima:** proposta de autoridade externa com credencial exclusiva do Joel, ledger append-only e API de reserva atômica por `(feature, tentativa)`; uma integração fail-closed na fronteira de rede para todos os chamadores de Bia, incluindo `plan-run`, contabilizando erros/retries. Alternativa: mecanismo do núcleo mediado manualmente por Joel. Não reduzir só `cards.py`/`feature.py` e alegar que I–L ficaram seguros.
- **Fora do escopo:** escrever `docs/plano/**`, `.env` real, núcleo e aumentar cotas para passar; adicionar um token liberador no worktree.
- **Dependências e ordem:** decisão de Joel sobre autoridade e local persistente fora da escrita; implementação futura de I–L integrada com migração de planos 4–6. Pergunta registrada com `perguntar_joel`.
- **Prova de regressão:** orçamento 4 rejeitado, estado forjado não reduz débitos, liberação forjada bloqueia, duas tentativas de rede consomem duas reservas, persistência indisponível nega rede, liberação válida só permite escopo declarado; plano legado testado no modo de migração.
- **Casos negativos/limites:** hook/local ledger editável não é autenticador; não aprovar retries não contabilizados.
- **Compatibilidade:** quebra de configuração (`biaBudget` 4–6), migração/CLI da liberação e consumidores `feature`/`plan-run` requerem decisão; custo de serviço/I/O externo não estimável.
- **Auditoria:** **trava — auditoria do Joel**, em commit separado pelo runner quando finalmente aplicável; nenhuma trava aplicada nesta análise.
- **Autorização:** pendente para modelo de liberação; novo núcleo permite travas, mas não cria identidade.
- **Custo/benefício esperado:** risco de orçamento alto; custo maior que benefício de uma proteção cosmética, adiar projeto integral.
- **Resultado observado:** só análise.
- **Motivo do status:** adiada — aguardando Joel.

### JV2-4 — limpar diagnósticos efêmeros da etapa
- **Causa e comportamento atual:** `dict.update` em `finish` acumula `message/red` de execução anterior na mesma etapa; `retro_text:562-564` reapresenta mensagem antiga.
- **Comportamento pretendido:** resultado concluído não carrega erro anterior; histórico de chamadas, segundos e demais contadores persiste.
- **Implementação mínima:** remover `message/red` da etapa na entrada de `finish` antes do update, sem zerar orçamento nem mudar resto do estado.
- **Fora do escopo:** reformatar estado persistente existente em `docs/plano/**`.
- **Dependências e ordem:** nenhuma; depois do item prioritário de checks.
- **Prova de regressão:** `finish` após falha com `message/red` seguido de done não os mantém; falha seguinte que fornece novos campos os retém; segundos acumulam.
- **Casos negativos/limites:** `retro_text` não deve narrar erro passado depois de done.
- **Compatibilidade:** CLI/config inalteradas; consumidores de `estado.json` deixam de ler diagnósticos obsoletos; custo insignificante.
- **Auditoria:** não aplicável.
- **Autorização:** escopo JV1-4.
- **Custo/benefício esperado:** evita decisões equivocadas com pequena alteração; valor não medido.
- **Resultado observado:** só análise.
- **Motivo do status:** aguardando aplicação.

### JV2-5 — resume por ID
- **Causa e comportamento atual:** `resume` aceita apenas caminho; falta regra de busca para IDs com múltiplas rodadas.
- **Comportamento pretendido:** identificar unicamente execução pendente sem retomar estado errado.
- **Implementação mínima:** adiada até especificação/reprodução do uso; nenhuma escrita.
- **Fora do escopo:** execução do produto e alterações em runs/.
- **Dependências e ordem:** definir desambiguação primeiro.
- **Prova de regressão:** ID único resolve, duplicidade e ausência recusam; caminho segue válido.
- **Casos negativos/limites:** IDs iguais em timestamps distintos, status não pendente.
- **Compatibilidade:** futura adição CLI compatível, config nenhuma; consumidores CLI precisam documentação; custo/benefício incertos.
- **Auditoria:** não aplicável.
- **Autorização:** escopo investigativo do Review.
- **Custo/benefício esperado:** sem frequência observada, adiar.
- **Resultado observado:** só análise.
- **Motivo do status:** falta regra segura para escolha por ID.

### JV2-6 — métricas, env e commits
- **Causa e comportamento atual:** API `quota()` já retorna valor consultado; `USAGE` só agrega `choices`, não há registro de usage em erros; `.env.example` exemplifica Alice, enquanto Bia exige chave OpenRouter; fluxo plan-run delega commit ao Claude.
- **Comportamento pretendido:** cota desconhecida aparece `?`, não zero medido; relatório de uso não inventa dados; exemplo da chave Abacus só após identificar consumidor; commit entre cartões exige decisão explícita que preserve invariantes do runner.
- **Implementação mínima:** nenhuma sem respostas brutas, prova de consumidor e regra de commit; não editar apenas documentação para atribuir suporte inexistente.
- **Fora do escopo:** `.env` real, mudanças de produto, modificar CLI de plano sem teste.
- **Dependências e ordem:** evidência adicional de API/CLI e decisão de fluxo.
- **Prova de regressão:** fixture de quota/usage da resposta real (inclusive erro), valor desconhecido distinto de zero, relatório sem double counting; commit só com requisito explícito.
- **Casos negativos/limites:** `0/0` das retros de Alice não prova custo de Bia; Abacus não deve ser vendido como OpenRouter.
- **Compatibilidade:** CLI/config/consumidores não alterados agora; mudança futura poderia quebrar integração de provedor e git; custo não estimado.
- **Auditoria:** não aplicável enquanto não houver mudança de cotas.
- **Autorização:** não há base para automação; nenhuma escrita.
- **Custo/benefício esperado:** gasto em hipótese excede benefício demonstrado.
- **Resultado observado:** só análise.
- **Motivo do status:** adiada a parte métricas/env; commit intermediário recusado neste ciclo.

### JV2-7 — não disparar Jorge do feature.py
- **Causa e comportamento atual:** `runner.auto_scope` consulta features concluídas e caixa; executar Jorge diretamente ao final de `cmd_feature` poderia iniciar Review antes do commit do Claude e concorrer com timer.
- **Comportamento pretendido:** Review fora da fila de produto, após feature concluída, sem múltiplos disparos.
- **Implementação mínima:** nenhuma; manter timer atual.
- **Fora do escopo:** alterar núcleo/timer.
- **Dependências e ordem:** nenhuma.
- **Prova de regressão:** não se aplica a evolução recusada; se evidência de atraso concreto surgir, medir latência e testar disparo idempotente pós-commit.
- **Casos negativos/limites:** retorno `ready` em `feature.py:532,583` não é commit nem aceite final.
- **Compatibilidade:** nenhum impacto CLI/config/consumidores; custo de Review extra evitado, mas não mensurado.
- **Auditoria:** não aplicável.
- **Autorização:** avaliação solicitada.
- **Custo/benefício esperado:** duplicidade e corrida custam mais do que a espera horária ainda não comprovada como problema.
- **Resultado observado:** recusada sem alteração.
- **Motivo do status:** ganho não demonstrado, gatilho existente.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Autoridade não falsificável para I–L | JV2-3 | `estado.json`, plano, arquivo de liberação em worktree são editáveis; só núcleo/serviço externo pode prover autoridade independente | (A) serviço/ledger externo com credencial exclusiva do Joel e débito atômico por tentativa (recomendado); (B) liberação manual via núcleo fora do alcance dos agentes. Pergunta registrada com `perguntar_joel`. | sim, somente JV2-3 |
| Migração de features existentes com `biaBudget` 4–6, se I–L avançar | JV2-3 | `cards.py:393` aceita até 6; fixture da suíte usa 4; `docs/plano/**` é proibido neste Review | migração separada por Joel/runner versus bloquear planos antigos; recomendo decidir antes da trava, sem editar planos aqui | sim, somente JV2-3 |
| Definir chave Abacus e regra de commits, caso haja requisito novo | JV2-6 | `bia.py:77-85` só aceita OpenRouter; `plan-run` deliberadamente não commita | documentar chave real de consumidor identificado ou manter exemplo atual; preservar commit do Claude (recomendado) até evidência | não para JV2-1/2/4 |

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 231 | não informadas | não informados | não informados | pedido do runner |
| Regressão antes da correção | — | não executada: análise só leitura | — | — | — | — | — |
| Após evolução | JV2-1/2/4 | aguardando aplicação; `run_tests()` após cada evolução | — | — | — | — | — |
| Final — runner | — | aguardando runner | — | — | — | — | — |

- **Comando:** `python3 -m unittest discover -s tests`, em `tools/alice-harness`.
- **Anomalias de descoberta/contagem:** desconhecidas; referência recebida 231. Zero testes não é verde; final deve ter ≥231.
- **Tentativas e falhas intermediárias:** nenhuma nesta análise; a recusa v1 está registrada em `harness-v1/relatorio.md:162-163`.
- **Desvios do relatório inicial:** não aplicável antes da aplicação.
- **Resultado transacional:** aguardando runner; nenhum commit ou diff alegado.
- **Commit:** a preencher pelo runner.
- **Se não aplicado:** especificar no fechamento e preservar diff somente conforme runner.
- **Evoluções revertidas:** nenhuma nesta análise.

## Custo da execução do Jorge

Dados de API, créditos e tempo serão preenchidos pelo runner; não inferidos do nome do modelo.

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage da API |
| Tokens de saída | indisponível | usage da API |
| Tokens totais | indisponível | runner, sem dupla contagem |
| Entrada em cache | indisponível | metadados de API |
| Raciocínio | indisponível | indicar inclusão na saída pelo runner |
| Custo monetário | indisponível | tabela de preços/usage indisponíveis |
| Chamadas de ferramentas / suítes | runner / 0 na análise | runner consolida |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial nesta fase; runner inclui retries e chamadas com erro que informarem consumo.
- **Estimativas separadas dos valores medidos:** impacto qualitativo, sem atribuição monetária.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** priorizar correção de cobertura e testes sob stub; I–L exigem autoridade externa antes de codificar; economia futura não medida.

---
## Verificação do runner
- Status: **nao_aplicada**
- Base: `07f5ea0c897d24906137b77f301ca6e5b8e7fbad`
- Suíte final: VERDE, 238 testes (referência 231)
- Arquivos alterados: ools/alice-harness/alice.py, tools/alice-harness/feature.py, tools/alice-harness/tests/test_feature_orchestrator.py, tools/alice-harness/tests/test_test_guardrails.py
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: escrita proibida: ools/alice-harness/alice.py (permitido: tools/alice-harness/**, docs/agents/**, .agents/policy.yaml, tools/jorge/agente/**; nunca segredos, núcleo, estado, apps, packages)

## Perguntas ao Joel (não bloquearam o Review)
- **JV2-3**: Para a liberação extraordinária da Bia (I–L), qual autoridade não forjável no worktree deseja usar: (A) serviço/ledger externo com credencial exclusiva do Joel e operação atômica de débito por tentativa (recomendado), ou (B) liberar manualmente cada execução por mecanismo do núcleo fora do alcance dos agentes? Um arquivo/token de liberação gravado no mesmo worktree NÃO autentica Joel; até definir a autoridade, manteremos liberação e ledger adiados.

## Resumo do finish
Implementadas para validação final do runner: JV2-1 (check de cobertura com tabela global `All files | Unknown% (0/0)` deixa de aprovar exit 0), JV2-2 (dois lotes da etapa tests rodam contra stub do HEAD com restauração de conteúdo, modo e preservação do índice; erros de preparo encerram etapa como error), JV2-4 (diagnósticos red/message antigos removidos ao atualizar etapa). Alterados: tools/alice-harness/alice.py, tools/alice-harness/feature.py, tools/alice-harness/tests/test_test_guardrails.py e tools/alice-harness/tests/test_feature_orchestrator.py. Travas aplicadas: nenhuma; portões não são travas. JV2-3 adiada — aguardando Joel definir autoridade não forjável para ledger/liberação I–L e migração dos planos de orçamento 4–6; pergunta registrada com alternativas serviço externo e núcleo mediado por Joel. JV2-5 adiada por falta de regra de desambiguação de resume por ID; JV2-6 adiada em métricas/env por falta de evidência de API e consumidor Abacus, commit intermediário recusado por contradizer fluxo atual; JV2-7 recusada porque timer já detecta feature e acionamento direto pode competir com commit. Testes: referência recebida VERDE 231; regressões antes das correções VERMELHO 233 (JV2-1), 235 (JV2-2), 238 (JV2-4); após evoluções VERDE 233, 237 e 238 respectivamente. Houve rodada intermediária VERMELHO 237 por expectativa errada de exceção no teste JV2-2, ajustada para status error; suíte final executada VERDE 238, sem alegar commit ou resultado final do runner. Desvio técnico JV2-2: isolamento implementado em função específica `implementation_stub`, sem mudar `with_stub` de complemento; teste também cobre arquivo ausente em HEAD, staged index, exceção e falha de git. Nenhuma requisição à Bia feita pelo Review.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 42 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 400298 |
| Entrada em cache | 2406905 |
| Tokens de saída | 11844 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 1837.88 |
| Passos análise / aplicação | 10 / 32 |
| Suítes rodadas | 8 |
| Início / fim | 2026-11-16T14:37:04-03:00 / 2026-11-16T14:40:07-03:00 |

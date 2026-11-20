# harness-v16 — diagnóstico de estouro e rollback de feature

## Identificação

- **Versão:** harness-v16
- **Data:** 2026-11-17T01:17:50-03:00 (informada; relógio não aferido)
- **Execução:** Review harness-v16; ID adicional não fornecido.
- **Estado da versão:** proposta.
- **Escopo recebido:** estouro sistêmico de toolCalls na leva das telas e rollback que descarta cartões done. Análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas, teto informado 3000 créditos.
- **Fontes recebidas:** anotação Claude/Joel 2026-11-17T01:17:50-03:00; `tools/jorge/logs/harness-v15/relatorio.md` (sem pendências executáveis; runner confirmou 278 testes); retros `tools/alice-harness/runs/retro-20261117-{010313,011130,011733,004715,004956}.md`; `docs/agents/orquestracao.md`; `docs/plano/E6.yaml` (somente leitura).
- **Base git:** `df752abb21afebfcbbd442532b4782f5197271b8` (`docs/mvp-planning`), worktree `jorge/harness-v16` informado.
- **Workspace inicial:** worktree isolado informado; limpeza não verificável com ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; metadados efetivos de API indisponíveis.
- **Autorizações de Joel:** nenhuma adicional; não alterar orçamento/cota da Bia nem `docs/plano/**`.
- **Suíte de referência:** VERDE, 278 testes, `python3 -m unittest discover -s tests` no harness, informada pelo runner; falhas/erros zero inferidos, ignorados não informados.

## Diagnóstico

### Fatos confirmados

- Retros `011130:5-7,11-19` e `011733:5-7,12-20` registram E6-T02 done em duas execuções (11 chamadas/57.779 tokens de entrada; 17 chamadas/162.807 tokens); E6-T07 failed com 21 e 24 chamadas (respectivamente 454.987 e 367.726 tokens). `010313:5-22` registra E7-T09 25 e E7-T10 21 chamadas, ambos failed. Valores de entrada de T02 divergem da estimativa 60–90k da anotação; são os números observados. `metricas(evolution)` mostra 4 runs no harness 001b3bd, 2/4 done, média de 18 chamadas; o recorte E6 anterior 85328f5 tem 5/5 não done e média de 27 chamadas; 554e4cc tem 2/2 não done e média de 23. `metricas(metrics)` agrega 40 runs, 20 done, 22.162.494 tokens de entrada da Alice; não isola economia atribuível a uma mudança.
- `feature.py:455-473` executa todos os cartões implement do plano via `plan_run`, atualiza `implement.cards` com os resultados e, se qualquer um falha, restaura **todos** os `allowedPaths` de implementação. `alice.py:1125-1145` guarda o arquivo anterior em `run_dir/previous` antes de devolver a HEAD; logo não é perda irrecuperável em todos os casos, mas o trabalho done sai da árvore ativa e é repetido. `feature.py:675-679` só pula `implement` no `all` quando todos os IDs atuais constam como done; `--stage implement` não reutiliza done parcial. `docs/plano/E6.yaml:61-62,99-100` mostra T02 e seu dependente T07 escrevendo ambos `apps/web/lib/simulation.ts`; manter/restaurar um arquivo inteiro não equivale a preservar apenas T02.
- `gates.py:108-134` já limita tentativas com nudge e tolerância de quatro chamadas; `alice.py:951-959,1039-1051` interrompe o lote e encerra failed quando aviso é ignorado. `retro.py:8,12-16` sinaliza >20 chamadas independentemente do orçamento individual, enquanto `cards.py:119-128` aceita até 30 e `alice.py:728` carrega o orçamento do cartão; `E6.yaml:84,128` declara 18/20. `retro.py:55-63` só avalia saúde em done/failed; uma falha `error` ou `card_error` de orçamento não recebe essa sinalização. Os estouros observados não provam que o teto de 20 seja capacidade universal do modelo: há checks vermelhos e 5 operações bloqueadas por allowedPaths em `011733:22-27`, além de checks vermelhos em `011130:21-26`.

### Causas e hipóteses

- **Confirmada:** rollback indiscriminado por feature e reexecução integral na retomada eliminam o trabalho done da árvore ativa quando um dependente falha. Outro mecanismo confirmado é o limite com tolerância intencional: `toolCalls` reporta chamadas efetivamente executadas, incluindo grace; `>20` do retro não significa por si só que o harness ignorou o orçamento do cartão.
- **Não confirmada:** que qwen3.5 9B seja incapaz de qualquer componente React/lógica com cobertura 100% em 20 chamadas; o recorte observado é pequeno e contém checks e escopos potencialmente defeituosos. Não se comprovou segurança de checkpoint parcial, nem quais chamadas seriam eliminadas com dicas adicionais. Preservar done com arquivo compartilhado exigiria estado verificável de versões intermediárias e decisão de propriedade sobre alterações do cartão falho.

### Justificativa econômica

- Repetição observada de T02 custa 57.779 e 162.807 tokens de entrada nas duas rodadas (métricas históricas de GPU local, não custo monetário do Jorge). Porém fazer checkpoint transacional por cartão implica superfície grande (arquivos compartilhados, SHA, revisão, checks, dependências, reversão parcial) e pode transformar trabalho falho em entrega aparente; manter rollback integral é mais econômico e seguro até decidir semântica. Para estouro de chamadas, já existe portão mecânico; alterar teto, aviso ou diagnóstico somente para maquiar >20 não é justificado pelo recorte.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV16-1 | Detecção de `toolCalls >20` sem explicitar limite real e tolerância no retro; possível percepção errada de falha sistêmica | `retro.py:8,12-16,55-63`; `gates.py:108-134`; retros `011130:5-7`, `011733:5-7` | **Não alterar agora:** investigar se retro deve distinguir `toolCalls > budget.toolCalls` de limiar de saúde >20, informando tolerância e falha do check; se houver dados suficientes, propor métrica sem afrouxar bloqueio | Em eventual Review posterior: `tools/alice-harness/retro.py`, `tools/alice-harness/tests/test_retro.py`, `tools/alice-harness/tests/test_plan_run.py` | Fixture com budget 18, 20 e 30, chamadas dentro/fora do limite; check vermelho e 0/0 permanecem vermelhos; retro identifica custo sem gerar verde | baixo para diagnóstico, médio se alterar significado de alerta existente | métrica | recusada neste Review — sem defeito do portão nem ganho líquido demonstrado |
| JV16-2 | Rollback integral descarta done e reexecução repete T02 | `feature.py:455-473,675-679`; `alice.py:1125-1145`; `docs/plano/E6.yaml:61-62,99-100`; retros `011130:5-7`, `011733:5-7` | Propor protocolo auditável de preservação/checkpoint por cartão, **não** desligar restore; decisão de Joel sobre arquivos compartilhados e evidência de aprovação | Em eventual Review posterior: `tools/alice-harness/feature.py`, `tools/alice-harness/alice.py` se necessário, `tools/alice-harness/tests/test_feature_orchestrator.py`, `docs/agents/orquestracao.md` | Dublê com T02 done/T07 failed compartilhando arquivo: não aprovar T07 nem reexecutar T02 sem versão intermediária verificada; check vermelho/erro restore/0/0 não dá done; isolados só preservados com SHAs e checks válidos | alto: aceitar estado inconsistente ou misturar mudanças do cartão falho | correção | adiada — aguardando Joel |

### JV16-1 — distinguir sintoma de estouro do portão existente

- **Causa e comportamento atual:** `retro.py` compara todos os cartões ao limiar de saúde 20, não ao orçamento individual; `CallBudget` usa tolerância para permitir `finish` verificado e interrompe a execução excedente. Recorte não demonstra bypass.
- **Comportamento pretendido:** nenhum verde nem aumento de cota; alertas futuros, se justificados, devem distinguir medição de chamadas executadas, budget declarado, chamadas de grace e falha de check.
- **Implementação mínima:** nenhuma neste Review: conservar alertas históricos, orçamento e portão; pedir novos dados antes de implementar contador paralelo.
- **Fora do escopo:** aumentar toolCalls dos cartões em `docs/plano/**` (escrita proibida), trocar modelo/provedor sem comparação controlada, alterar política de Bia.
- **Dependências e ordem:** nenhuma; nenhuma alteração executável.
- **Prova de regressão:** teste futuro deve falhar sobre discrepância comprovada e manter verde somente com checks e cobertura reais; não há defeito original do limite mecânico provado para justificar regressão agora.
- **Casos negativos/limites:** `0/0` nunca verde; erro de ferramenta ou check vermelho não é explicado somente pelo modelo; calls permitidas durante grace não devem ser rotuladas como bypass.
- **Compatibilidade:** CLI/configuração/consumidores inalterados; custo esperado nenhum no Review, eventual diagnóstico com custo de manutenção não estimável.
- **Auditoria:** não aplicável. **Autorização:** pedido de avaliação recebido.
- **Custo/benefício esperado:** sem economia demonstrável; automação adicional não compensa agora.
- **Resultado observado:** nenhum código alterado na análise. **Motivo do status:** recusada neste Review, reavaliar apenas com prova reproduzível de defeito.

### JV16-2 — preservar done sem falsificar entrega

- **Causa e comportamento atual:** `feature.py` restaura todos os allowedPaths no primeiro failed e, no próximo implement, passa todos os cartões; T02/T07 compartilham `simulation.ts`, logo arquivo inteiro contém possivelmente alterações de ambos. Backup existente não comprova fronteira de mudanças aprovada.
- **Comportamento pretendido:** nunca reusar done por status isolado; se autorizado protocolo, estabelecer versão intermediária identificável e válida dos arquivos de T02, manter testes protegidos e SHAs atuais, dependências verificadas, checks verdes (0/0 reprova), e rollback seguro de alterações de T07 antes de reutilizar T02; só então saltar T02, sem falsear `implement: done` ou `audit` da feature.
- **Implementação mínima:** aguardar escolha de semântica; possível fase inicial apenas para allowedPaths exclusivos com snapshot e SHA, sem reutilização de compartilhados até checkpoint confiável; não remover restore existente sem prova.
- **Fora do escopo:** editar `docs/plano/**`, produto, estados reais da execução; commits ou aprovações de cartões pela automação; alterar limites de Bia.
- **Dependências e ordem:** decisão de Joel antes de qualquer aplicação; depois testes de snapshot/restore e de retomada; não depende de JV16-1.
- **Prova de regressão:** antes, T02 done/T07 failed aciona restore e rerun T02; depois, somente cenário autorizado e comprovado retém T02 e reroda apenas T07; caminho compartilhado sem checkpoint, snapshot ausente/adulterado, mudança de teste, check vermelho/0/0 ou erro de restore falham fechados. Fixture isolada deve conferir arquivos e estado, não apenas número de chamadas.
- **Casos negativos/limites:** E6 real compartilha allowedPaths; somente preservar status, ler `previous/` ou retirar o restore geraria falso positivo. Não aceitar mapa parcial em `audit`/aceite. No orçamento limite, falha não vira done.
- **Compatibilidade:** eventual mudança no significado de `--stage implement`/`all` e estados persistidos exige migração explícita e documentação; configuração de Bia inalterada; consumidores podem deixar de reexecutar cartões *apenas* após validação de snapshot. CLI atual permanece intacta neste Review.
- **Auditoria:** não é trava formal; risco de integridade alto. **Autorização:** decisão pendente de Joel registrada por `perguntar_joel`.
- **Custo/benefício esperado:** evitar repetição de T02 pode economizar tokens locais medidos nas retros; custo de engenharia/testes e chance de dados incorretos ainda não quantificados, por isso não aplicar no escuro.
- **Resultado observado:** nenhuma aplicação; pendente. **Motivo do status:** adiada — aguardando Joel.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Semântica de preservação parcial em feature | JV16-2 | T02/T07 compartilham arquivo; status done não é checkpoint | Preservar apenas cartões com allowedPaths exclusivos e SHA verificável, bloqueando compartilhados; **ou**, recomendado, manter rollback integral até protocolo de checkpoint/commit por cartão com revisão e prova para compartilhados | Sim, apenas JV16-2; Review pode terminar sem alteração |

Nenhuma alteração de produto ou `docs/plano/**` autorizada por este relatório.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 278 | 0 inferido | 0 inferido | não informado | pedido do runner |
| Regressão antes da correção | — | não executada: análise só leitura | — | — | — | — | análise |
| Após evolução | — | não prevista nesta versão | — | — | — | — | proposta |
| Final — runner | — | pendente do runner | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; 0 testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma suíte executada na análise.
- **Desvios do relatório inicial:** nenhum até aqui.
- **Resultado transacional:** sem diff previsto; runner confirma. **Commit:** runner decide. **Se não aplicado:** sem implementação autorizada. **Evoluções revertidas:** nenhuma.

## Custo da execução do Jorge

Valores de uso da API/runner indisponíveis na análise; métricas históricas de Alice não são custo deste Review.

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | runner; sem dupla contagem |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | indicar se incluído na saída |
| Custo monetário | indisponível | runner/tabela de preços |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta análise | runner |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial, aguardando runner.
- **Estimativas separadas dos valores medidos:** nenhum valor monetário estimado; 57.779 e 162.807 tokens são de runs históricos, não desta execução.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** manter proteção e medir antes de mexer no portão; otimização do rollback pode ter benefício, mas segurança e custo de protocolo ainda exigem decisão antes de qualquer escrita.

---
## Verificação do runner
- Status: **sem_mudancas**
- Base: `df752abb21afebfcbbd442532b4782f5197271b8`
- Suíte final: VERDE, 278 testes (referência 278)
- Arquivos alterados: nenhum
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Perguntas ao Joel (não bloquearam o Review)
- **JV16-2**: Para o rollback parcial de feature: prefere preservar apenas arquivos de cartões done com allowedPaths exclusivos e SHA verificável (bloqueando quando há arquivo compartilhado, como E6-T02/E6-T07 em simulation.ts), ou manter rollback integral até definir um protocolo de checkpoint/commit por cartão com revisão? Recomendo manter rollback integral nesses casos até existir protocolo auditável, sem considerar status done isolado como prova.

## Resumo do finish
harness-v16: nenhum ID implementado. JV16-1 recusada neste Review: o portão de chamadas já limita a execução; os estouros observados não comprovam defeito mecânico nem justificam mudar alertas. JV16-2 adiada — aguardando Joel: T02/T07 compartilham simulation.ts, e preservar apenas o status done sem checkpoint verificável arrisca manter alterações falhas. Pergunta registrada ao Joel sobre semântica de preservação parcial; recomendação de manter rollback integral até protocolo auditável. Arquivos alterados: nenhum. Travas aplicadas: nenhuma. Testes: suíte de referência informada verde (278); nenhuma evolução aplicada, portanto não houve suíte após evolução. Desvios: nenhum; nenhuma escrita em produto ou estado real. Não afirmo commit, integração ou economia realizada.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 14 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 199680 |
| Entrada em cache | 508174 |
| Tokens de saída | 5447 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 907.59 |
| Passos análise / aplicação | 13 / 1 |
| Suítes rodadas | 0 |
| Início / fim | 2026-11-17T01:17:50-03:00 / 2026-11-17T01:18:56-03:00 |

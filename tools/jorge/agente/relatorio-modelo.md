# harness-v<N> — <título curto>

## Identificação

- **Versão:** harness-v<N>
- **Data:** <ISO 8601 com fuso>
- **Execução:** <ID do runner>
- **Estado da versão:** <proposta | aplicada | parcialmente aplicada | não aplicada | sem alterações>
- **Escopo recebido:** <pedidos de Joel, incidentes e limites deste Review>
- **Fontes recebidas:** <retros/documentos, com caminhos>
- **Base git:** <SHA completo>
- **Workspace inicial:** <limpo / execução bloqueada>
- **Modelo/provedor efetivamente utilizados:** <metadados da API; não presumir pelo nome configurado>
- **Autorizações de Joel:** <referência, objeto e alcance; ou nenhuma>
- **Suíte de referência:** <resultado, contagens, data e origem; ou não fornecida>

## Diagnóstico

### Fatos confirmados
- <Problema observado, consequência e evidência na base git.>

### Causas e hipóteses
- **Confirmada:** <causa e mecanismo da falha>.
- **Não confirmada:** <hipótese, informação faltante e efeito na decisão>.

### Justificativa econômica
- <Frequência, impacto e esforço estimado; explicitar estimativas e incertezas.>
- <Por que corrigir agora compensa, ou por que adiar/fazer diretamente é melhor.>

## Evoluções

Na análise, use `adiada` com motivo “aguardando aplicação” ou “aguardando Joel”. `Aplicada` é confirmação exclusiva do runner após validação final e commit.

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV<N>-1 | <problema> | <referência> | <mudança mínima> | <caminhos> | <teste e resultado esperado> | <baixo/médio/alto + motivo> | <correção/trava/métrica/simplificação> | <aplicada/adiada/recusada> |

### JV<N>-1 — <nome>

- **Causa e comportamento atual:** <descrição verificável>.
- **Comportamento pretendido:** <invariante e ponto de bloqueio mecânico>.
- **Implementação mínima:** <alterações delimitadas; sem refatoração incidental>.
- **Fora do escopo:** <exclusões explícitas>.
- **Dependências e ordem:** <IDs ou nenhuma>.
- **Prova de regressão:** <qual teste falha antes, por quê e como passa depois>.
- **Casos negativos/limites:** <bypass, entrada inválida, falha de ferramenta, 0/0, conforme aplicável>.
- **Compatibilidade:** <CLI, configuração e consumidores; migração se necessária>.
- **Auditoria:** <“trava — auditoria do Joel”, quando aplicável; caso contrário, não aplicável>.
- **Autorização:** <referência explícita ou pendente>.
- **Custo/benefício esperado:** <estimativa fundamentada ou não estimável>.
- **Resultado observado:** <preenchido após aplicação; não prometer resultado>.
- **Motivo do status:** <incluindo rollback, dependência ou recusa>.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| <decisão ou nenhuma> | <ID> | <evidência> | <alternativas> | <sim/não> |

Mudanças necessárias fora da lista de escrita devem aparecer aqui. Este relatório não concede permissão para executá-las.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | <resultado> | <n> | <n> | <n> | <n> | <ID da chamada/registro> |
| Regressão antes da correção, se feita | <ID> | <falha esperada confirmada ou não> | <n> | <n> | <n> | <n> | <referência> |
| Após evolução | <ID> | <resultado> | <n> | <n> | <n> | <n> | <referência> |
| Final — runner | — | <resultado> | <n> | <n> | <n> | <n> | <referência> |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** <nenhuma ou explicação; zero testes não é verde>.
- **Tentativas e falhas intermediárias:** <resumo, sem omitir custo de retrabalho>.
- **Desvios do relatório inicial:** <nenhum ou descrição e autorização>.
- **Resultado transacional:** <commit / rollback / sem diff>.
- **Commit:** <SHA e mensagem, preenchidos pelo runner>.
- **Se não aplicado:** <motivo e referência ao diff preservado pelo runner>.
- **Evoluções revertidas:** <IDs; status final adiadas ou recusadas, nunca aplicadas>.

## Custo da execução do Jorge

Dados preenchidos pelo runner a partir da API, abrangendo análise, aplicação, retries e chamadas com erro que tenham consumo informado.

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | <n> | <registro> |
| Tokens de entrada | <n ou indisponível> | <usage> |
| Tokens de saída | <n ou indisponível> | <usage> |
| Tokens totais | <n ou indisponível> | <sem dupla contagem> |
| Entrada em cache | <n ou indisponível> | <subconjunto ou categoria, conforme provedor> |
| Raciocínio | <n ou indisponível> | <indicar se já incluído na saída> |
| Custo monetário | <valor/moeda ou indisponível> | <cobrado ou estimado; tabela de preços e data> |
| Chamadas de ferramentas / suítes | <n / n> | <runner> |
| Duração total | <tempo> | <runner> |

- **Cobertura da medição:** <completa/parcial; chamadas sem usage>.
- **Estimativas separadas dos valores medidos:** <método, se houver>.
- **Consumo de Bia:** <nenhum pelo Review; ou incidente explícito, nunca embutido/omitido>.
- **Conclusão:** <benefício esperado versus custo; não declarar economia realizada sem medição>.

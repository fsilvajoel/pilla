# Alice original: execuções H-01 a H-05 (14/11/2026)

Registros da primeira versão do harness da Alice (`alice-harness`, repositório separado, já removido). Nessa leva a Alice implementou módulos do próprio harness. É material de estudo, nada disso está em uso.

| Arquivo | O que é |
|---|---|
| `tasks/H-0N.yaml` | cartão da tarefa: escopo, arquivos permitidos, checks, critério de pronto, orçamento |
| `runs/H-0N.report.json` | relatório final da execução (status, tentativas, chamadas de ferramenta, tokens da Alice) |
| `runs/H-0N.verificacoes.jsonl` | cada rodada de verificação (checks) e os problemas apontados |
| `runs/H-0N.trajetoria.jsonl` | sequência de ferramentas usadas pela Alice (só nome e caminho, sem o conteúdo) |
| `runs/metrics.jsonl` | métricas da leva (H-01 a H-04 preenchidas depois, `backfill`) |
| `runs/batch.log`, `runs/gate.log` | tempo e código de saída de cada tarefa; teste do gate SSH (ALLOW/DENY) |

Resumo: H-01, H-03, H-04 e H-05 terminaram; H-02 (política em YAML) falhou após 4 tentativas, presa em regex dentro do YAML, e gastou cerca de 970 mil tokens de prompt.

Ficaram de fora o código, os `state.json` e `log.jsonl` brutos (conversa completa) e o `.env`. Caminhos locais viraram `<harness>` e `<home>`.

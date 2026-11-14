# Decisões menores

| ID | Data | Decisão | Por quê |
|---|---|---|---|
| DM-001 | 2026-11-14 | O `alice-harness` fica em Python (stdlib + PyYAML) até a E0; reescrita em TS é opcional depois. | Já funciona; o repositório do produto ainda não tem Node. |
| DM-002 | 2026-11-14 | Testes do harness com `unittest` (stdlib). | Nenhuma dependência nova. |
| DM-003 | 2026-11-14 | Papéis especializados são **modos** da Alice (`kind` no cartão), não agentes novos. | Auditoria §8: agente novo custa contexto e coordenação. |
| DM-004 | 2026-11-14 | Regras de proteção (sites oficiais, arquivos protegidos, padrões proibidos, limites) têm fonte única em `.agents/policy.yaml`. | Evita divergência entre AGENTS.md, harness e CI. |

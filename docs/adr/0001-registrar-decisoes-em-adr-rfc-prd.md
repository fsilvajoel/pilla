# ADR-0001 — Registrar decisões em PRD, RFC e ADR

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | Decisão do Joel |

## Contexto
O pilla é um produto de estudo de arquitetura e será construído em grande parte por agentes de IA. Sem decisões escritas, cada agente reinterpreta o problema, gerando conflito entre módulos e retrabalho.

## Decisão
- Decisões de **produto** ficam em PRD (`docs/prd/`).
- Propostas **técnicas** detalhadas ficam em RFC (`docs/rfc/`).
- Decisões **arquiteturais** ficam em ADR (`docs/adr/`), curtas, numeradas e imutáveis após aceitas.
- Pontos legais ficam em `docs/legal/`, separados.
- Agentes só implementam PRD/RFC aprovados e ADRs aceitas, e citam os IDs nos commits/PRs.

## Consequências
- Toda mudança relevante começa por documento; o código segue o documento.
- Mudar uma decisão = nova ADR que substitui a anterior (histórico preservado).
- Custo: escrever antes de codar. Aceito por ser o objetivo do estudo.

## Alternativas consideradas
- Só README/wiki: sem histórico de decisão nem status.
- Decidir no código/PR: decisões ficam espalhadas e invisíveis aos agentes.

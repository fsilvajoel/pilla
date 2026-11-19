# Plano: issues do GitHub em pt-BR (ADR-0016)

Objetivo: `sync` gera, para cada feature e defeito, uma issue em pt-BR com a especificação do card, DoR/DoD,
ADRs/RFCs/PRD referenciados e imagens. Executável pela Alice em etapas pequenas, com conferência do orquestrador.

## Fontes por tipo de issue
| Seção | Feature | Defeito |
|---|---|---|
| Título/ID, entrega | `E*.yaml` (`delivery`, `title`) | `defeitos/D<n>.md` (h1) |
| Resumo e escopo | `plano/<F>/plano.md` (Escopo, Contrato) | `D<n>.md` (Reprodução) |
| Regras e critérios | PRD (RF/RN/CA citados em `refs`) | `D<n>.md` (esperado, "Qual regra deixou passar?") |
| Cartões, DoR, DoD | cartões: `dependsOn`, `allowedPaths`, `done`, `checks` | `Correção` e `evidência` |
| Decisões | ADR/RFC de `refs`, `decisoes-*.md` | `revisao.md` da feature de origem |
| Telas | `prd/telas/*`, `plano/<F>/*.png` | imagens citadas no `D<n>.md` |
| Estado | `estado.json`, `status.json` | campo Status |

## Etapas (decisão do Joel, 19/11: o dado sai em pt-BR já na primeira execução)
Sem renderizador separado e sem conferência de tokens: E8-F01 e E8-F02 saíram do plano. Os cartões
E8-T01..T03 saíram junto.
1. **Integração** (E8-T04): o `sync_github_project.py` gera o corpo em pt-BR a partir das fontes, mantém o
   marcador, o filtro de segredos e a idempotência; adiciona issues de defeito (label `bug`) e labels de entrega.
2. **Imagens**: links `?raw=true` com o PNG já commitado no `main` antes do `--apply`.
3. **Gate** (E8-T05): sem inglês residual fora de código e IDs, links válidos, corpo abaixo de 65k caracteres.
4. **Rodada real** (E8-T06): `--apply` em dry-run; Joel vê 2 issues-piloto, depois todas (#1–#13 e D1–D3).

## Receita para a Alice (tarefa recorrente futura)
"Atualizar as issues": (1) `sync_github_project.py --dry-run` (gera o corpo em pt-BR); (2) conferir o diff;
(3) `sync_github_project.py --apply` (precisa do ok do Joel e `gh` com escopo `project`). Alice nunca decide
estrutura nem altera os docs-fonte.

## Riscos
- Tradução alterar IDs/código → gate de tokens. · Issue >65k → resumo pela Alice e link para o doc. ·
  Imagem não aparecer → conferir repo público e caminho no `main`.

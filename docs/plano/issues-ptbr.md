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

## Etapas (cada uma = um cartão pequeno; E8 sugerida)
1. **Renderizador** (`render_issue.py`, harness-ada, Python stdlib, determinístico): lê os docs, gera
   `issue.md` por feature/defeito com seções fixas em pt-BR; inglês dos cartões entra marcado
   `<!--t:HASH-->texto original<!--/t-->`. Falha se link de doc/imagem não resolve. Testes com 2 features reais (E7-F01, E4-F02) e D1.
2. **Tradução** (Alice): para cada bloco `<!--t:-->`, prompt fixo ("traduza para pt-BR técnico, preserve
   código, IDs, nomes de arquivo e números; devolva só o texto"). Saída em `issue.pt-br.md` com cache por hash.
   O orquestrador confere: IDs/código intactos (script compara tokens entre original e tradução).
3. **Imagens**: resolver links `?raw=true`; verificar que o PNG está commitado no `main` antes do `--apply`.
4. **Integração**: `sync_github_project.py` usa o corpo renderizado no lugar do corpo de status; mantém o marcador,
   filtro de segredos e idempotência; adiciona issues de defeito (label `bug`) e labels de entrega.
5. **Gate**: `check_issue_render.py` (sem inglês residual fora de código/IDs, links válidos, <65k chars) e
   atualização do `workflow/` + `script/README.md` do Ada.
6. **Rodada real**: `--apply` em dry-run, Joel vê 2 issues-piloto, depois todas (#1–#13 e D1–D3).

## Receita para a Alice (tarefa recorrente futura)
"Atualizar as issues": (1) `render_issue.py --all`; (2) traduzir só blocos novos/alterados; (3) `check_issue_render.py`;
(4) `sync_github_project.py --apply` (precisa do ok do Joel e `gh` com escopo `project`). Alice nunca decide estrutura
nem altera os docs-fonte.

## Riscos
- Tradução alterar IDs/código → gate de tokens. · Issue >65k → resumo pela Alice e link para o doc. ·
  Imagem não aparecer → conferir repo público e caminho no `main`.

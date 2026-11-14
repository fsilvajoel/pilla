# Memória do projeto

Conhecimento curto que não cabe numa ADR e que evita redescobrir coisas a cada sessão.

| Arquivo | O que guarda |
|---|---|
| [licoes.md](licoes.md) | armadilhas e aprendizados (de execuções da Alice, revisões, CI) |
| [decisoes-menores.md](decisoes-menores.md) | escolhas pequenas que não merecem ADR |
| [modulos/](modulos/) | ficha por módulo (≤ 300 palavras): propósito, API pública, invariantes, mapa de arquivos |

Regras:
- **Quem grava:** a Alice propõe (campo `lessons` do `finish`); o Claude faz a curadoria e comita. Ninguém grava sem revisão.
- **Formato:** uma entrada = ID, data, 1–3 linhas, origem (tarefa, PR ou ADR).
- **Nunca:** IP, senha, token, nome de pessoa real, dado de cliente (repositório público).
- Decisão arquitetural continua sendo ADR; regra de negócio continua no PRD. Aqui só o que falta neles.
- Entrada que ficou errada é apagada, não acumulada.

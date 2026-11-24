# Evolução do Harness: da V0 à fábrica de software com IA

Este diretório consolida a história de um projeto de automação de desenvolvimento de software com IA.
Ele foi criado para compilação futura em uma série de artigos no LinkedIn.

## Linha do tempo

| Versão | Ideia central | Resultado |
|---|---|---|
| V0 | Claude supervisionando, Alice local implementando, card, tools e testes | Prova a viabilidade, mas o laço ainda depende de sessões e coordenação |
| V1 | Harness-adaV1: papéis, skills, gates, adaptadores e workflow por feature | Separa conhecimento, execução e fluxo, mas o orquestrador continua conectando etapas |
| V2 proposta | Motor Python determinístico, event log, fallbacks, worktrees e SDD completo | Pretende rodar a fábrica de ponta a ponta e reservar IA para trabalho cognitivo |

## Estrutura editorial

| Arquivo | Uso |
|---|---|
| [01-linha-do-tempo.md](01-linha-do-tempo.md) | evolução histórica e decisões tomadas |
| [02-diagnostico-v1.md](02-diagnostico-v1.md) | o que funcionou, o que quebrou e causa-raiz |
| [03-arquitetura-v2.md](03-arquitetura-v2.md) | Control Plane, Execution Plane, Artifact Plane e máquina de estados |
| [04-modelo-sdd-cards.md](04-modelo-sdd-cards.md) | padrão de PRD, ADR, RFC, plano e cartão |
| [05-custo-e-modelos-locais.md](05-custo-e-modelos-locais.md) | economia de tokens e viabilidade do orquestrador local |
| [06-plano-evolucao-v2.md](06-plano-evolucao-v2.md) | plano executivo completo por ondas |
| [07-drafts-linkedin.md](07-drafts-linkedin.md) | esqueleto de posts com fontes e imagens |
| [fontes/](fontes/) | documentos históricos e relatórios |
| [graficos/](graficos/) | gráficos medidos e comparativos |

## Tese principal

O principal aprendizado não é "usar o melhor modelo". É separar com precisão:

1. regras permanentes;
2. conhecimento reutilizável;
3. ações determinísticas;
4. trabalho cognitivo;
5. evidência objetiva;
6. decisão humana.

Quanto mais o motor consegue decidir, verificar e registrar, menos contexto o modelo precisa processar.

## Salvaguarda editorial

- dados de tokens são publicados quando há registro;
- estimativas são identificadas como estimativas;
- ausência de medição não vira conclusão;
- imagens devem preservar a fonte;
- decisões públicas não devem incluir nomes, chaves, IPs ou dados pessoais;
- o diretório histórico permanece separado do código ativo.

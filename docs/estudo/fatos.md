# Ficha de fatos do estudo (fonte para o artigo; tudo aqui pode ser público)

## Contexto e dores
- Projeto de estudo "pilla": sistema de gestão de empréstimos que substitui uma planilha com erros (saldo com sinal manual, renovação duplicada como linha nova, datas em texto livre). Objetivo duplo: o produto e provar arquitetura escalável construída por agentes de IA.
- Dor 1: custo/limite de tokens do Claude em tarefas braçais (tentativa e erro, leitura de arquivos grandes).
- Dor 2: modelo local sozinho inventa API e "faz o teste passar de qualquer jeito".
- Dor 3: contexto inchado (reler documentação inteira a cada tarefa).
- Dor 4: uma pessoa só (o autor) para decidir, revisar e aprovar.

## Hardware e ferramentas
- Modelo local "Alice": gemma4 12B via Ollama numa RTX 5070 (12 GB de VRAM) num PC Windows; contexto de 32 mil tokens. Outros modelos disponíveis para testes futuros: qwen3.6 35B-A3B (MoE) e gpt-oss 20B.
- Desenvolvimento numa VM Debian 13 num servidor doméstico com Proxmox; a Alice é acessada pela rede local.
- Claude (Anthropic) via Claude Code como tech lead.
- Busca: API do Brave, restrita a documentação oficial (lista de domínios).
- Skills de terceiros (tech-leads-club/agent-skills, MIT) revisadas e fixadas por commit: coding-guidelines, the-judge, tactical-ddd, security-threat-model etc.

## Como funciona (arquitetura)
- Hierarquia Supervisor–Worker: Joel decide e aprova; Claude planeja, escreve testes e travas, revisa e comita; Alice implementa.
- Spec Driven: PRD (produto) → RFC (proposta técnica) → ADR (decisão). Regras com ID estável (RN-C03, CA-01, T-13). 16,7 mil palavras de documentação antes de qualquer linha de código. Só se implementa doc aprovado.
- TDD com separação de papéis: quem escreve o teste não implementa; testes ficam protegidos contra escrita da Alice.
- Harness próprio (Python, só stdlib + PyYAML, ~550 linhas): cartão de tarefa YAML (allowedPaths, protectedTests, checks, budget, kind, rules); ferramentas limitadas (ler/buscar no repo, escrever só onde o cartão deixa, editar trecho, ver diff, rodar checks fixos, buscar em doc oficial, perguntar ao Claude, finalizar). Sem shell livre, sem git, sem rede livre. `.env` ilegível.
- Verificação final pelo próprio ambiente: arquivos alterados ⊆ allowedPaths; varredura de marcadores proibidos no diff (any, @ts-ignore, eslint-disable, .only/.skip, console., TODO sem ID); todos os checks.
- "Nunca invente": dúvida → docs do projeto → doc oficial → ask_claude (pausa a tarefa; o Claude devolve só a resposta). Regra de negócio nunca vem da web.
- Retorno compacto ao Claude (status, arquivos, tentativas, tokens, lições): o ciclo de tentativa e erro fica na GPU.
- Política de travas como dado (`.agents/policy.yaml`), fonte única para harness e CI.
- Memória curada no repositório (lições, decisões menores, fichas de módulo): a Alice propõe lições no fim de cada tarefa, o Claude faz a curadoria.
- Papéis especializados viraram "modos" da Alice (implement, test-author, pre-review, docs, cards) em vez de novos agentes.
- Porteiro SSH (forced command) para a chave da Alice: só comandos do harness e leitura.

## Linha do tempo (superficial)
1. Modelagem do negócio a partir da planilha; PRD, 5 RFCs, 13 ADRs, glossário pt→código, pontos legais.
2. AGENTS.md (guia dos agentes) com travas por camada.
3. Harness v1 + tarefa de brinquedo (TOY-T01) para validar.
4. Auditoria da arquitetura de agentes (comparação com Supervisor–Worker, Spec Driven, AI-augmented TDD, Context Engineering, Memory-first).
5. V1 da auditoria: a Alice implementou 4 módulos do próprio harness a partir de testes do Claude (H-01..H-04) e rascunhou o README (H-05).
6. Harness movido para dentro do repositório (git subtree), protegido contra a própria Alice.

## Resultados medidos (ver dados.json)
- Mesma tarefa TOY-T01: 1ª versão 48 mil tokens da Alice (35 mil de saída); harness novo 33 mil (2,3 mil de saída), 21 s.
- `think` desligado: resposta simples de 301 → 14 tokens; 61 s → 9 s.
- V1: Claude ~45 mil tokens (estimado) × Alice 1,96 milhão (medido, custo zero de API). Cerca de 21 min no relógio.
- 5 tarefas: 4 aprovadas na verificação; 1 reprovada por falso positivo do próprio harness. 2 de 5 entregas precisaram de correção do Claude (formato de ID frouxo; regex corrompida que o teste não pegou).
- Custo de entrada cresce com o histórico: tarefa longa (23 chamadas) = 762 mil tokens de entrada.
- AGENTS.md: 2.422 → 1.154 palavras. 129 IDs de regra indexados. 27 testes do harness. Porteiro: 8 comandos testados, 3 permitidos, 5 negados.
- Erros encontrados: 2 falsos positivos do harness, 1 erro de integração do Claude, 1 regex corrompida pela Alice. Todos pegos por teste/verificação ou revisão.

## Produção deste estudo
- Gráficos: script escrito pela Alice (E-01, 74 s, 1ª tentativa). Ajustes (E-02): 1ª execução reprovada porque o Claude escreveu arquivos na mesma pasta durante a execução e porque o modelo montou mal chamadas de ferramenta com código grande; harness corrigido; 2ª execução aprovada em 45 s.
- Rascunho do artigo: Alice em 22 s (1.217 palavras, 4 erros factuais); versão final reescrita pelo Claude.

## Plano de entrega (cartões E0/E1)
- Validador de cartões (cards.py) escrito pela Alice a partir de testes do Claude (H-06): 54 s, 2 tentativas.
- Cartões num arquivo só, via ferramenta: 41 min, 2,6 milhões de tokens de entrada, sem terminar; o E0 gravado fugiu do plano.
- Mesmos cartões gerados por partes em modo texto (um par por pedido) e montados por script: 29 s, ~15 mil tokens; estrutura válida, mas 6 de 17 com critérios de pronto inventados, corrigidos pelo Claude.
- Lição: o modelo local rende em pedidos pequenos e fechados; sessões longas e saídas grandes degradam.

## Ainda NÃO testado (conclusões pendentes)
- Geração de código TypeScript do produto (E1: motor financeiro; depois API, banco, frontend).
- Modo test-author (Alice escrevendo testes), pre-review, fila de tarefas, CI com todas as travas (lint, tipos, fronteiras, mutação).
- Comparação com o Claude fazendo a mesma tarefa sozinho (custo × qualidade × tempo).

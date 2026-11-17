# alice-harness

Ambiente de trabalho da Alice (modelo local no Ollama): executa as ferramentas que ela pede, com limites (leitura do repositório, escrita restrita, testes, busca em documentação oficial). Configuração em `.env` (ver `.env.example`).

## Comandos
- `alice.py cards <plano.yaml>... --repo <path>`: valida os cartões (forma e as regras de escrita de [cartao-de-tarefa.md](../../docs/agents/cartao-de-tarefa.md)). Rodar antes de qualquer fila.
- `alice.py run <cartão.yaml> --repo <path>`: executa um cartão. Faz o pré-voo antes de chamar o modelo.
- `alice.py plan-run <plano.yaml> <ID>... --repo <path>`: fila de cartões de um plano, com retrospectiva e tokens no fim.
- `alice.py feature <plano.yaml> <F> [--stage plan|tests|implement|audit|review|all] [--rounds N] --repo <path>`: orquestração por feature (ADR-0014, [orquestracao.md](../../docs/agents/orquestracao.md)): a Bia escreve todos os testes numa chamada, a Alice implementa local (`plan-run`), a Bia audita numa chamada e o harness prepara `docs/plano/<F>/revisao-final.md` para o Claude. Estado em `docs/plano/<F>/estado.json`; `all` continua da primeira etapa não feita. Instruções fixas por papel em `roles/`.
- `alice.py resume <run_dir> --answer "<texto>"`: continua uma execução que parou com pergunta. Recusa se houver arquivo alterado fora do cartão.
- `alice.py status`: diz se há execução em andamento (ninguém edita o repositório enquanto houver).
- `alice.py rule <ID>... [--repo <path>]`: mostra a definição de uma regra (RN-C03, T-13) ou seção de documento.
- `alice.py metrics` / `alice.py evolution`: resumo de `runs/metrics.jsonl`; evolução por versão do harness.
- `alice.py claude-usage [--since ISO] [--until ISO]`: tokens reais do Claude na sessão mais recente e subagentes. `alice.py cost <ID>... [--since ISO] [--until ISO]` soma todas as sessões do repositório desde antes da introdução dos cartões no git; sem cartão versionado, exige `--since` explícito. Datas ISO sem fuso são UTC; offsets são convertidos para UTC.
- `alice.py chat "<pergunta>" [--file <path>]`: pergunta direta ao modelo, sem ferramentas (só resumo e rascunho).

## Pré-revisão local inconclusiva (ADR-0014)
`bia.py gate` sai com 5 quando reprova sem nenhuma nota com apoio no pronto (`grounded`): o filtro local não bloqueia sozinho; no `plan-run` o cartão fica `escalated` sem gastar rodada e o Claude decide.

## Estados de uma execução
| Status | Significa | De quem é |
|---|---|---|
| `done` | verificação aprovada (escopo, portões, todos os checks) | — |
| `needs_input` | o modelo perguntou (`ask_claude`); continuar com `resume` | — |
| `failed` | acabou o orçamento (tentativas, chamadas, minutos) ou travou em laço | classificar: cartão, harness ou modelo |
| `card_error` | o pré-voo reprovou o cartão; o modelo nem foi chamado | de quem escreveu o cartão |

## Pré-voo (LI-056)
Antes da primeira chamada ao modelo: o comando de cada check existe; os arquivos de `readFirst` e `protectedTests` existem; e, em tarefa de escrita, pelo menos um check está vermelho (se todos já passam, nenhum check distingue pronto de não pronto). Custa segundos e para no primeiro check vermelho.

## O pedido
`Run.system_prompt` monta o pedido em seções fixas (TAREFA, ARQUIVOS, PRONTO QUANDO, REGRAS DE CÓDIGO, FERRAMENTAS, FLUXO). Entram sozinhos: as definições de `rules`, a cola do lint ([docs/memoria/lint.md](../../docs/memoria/lint.md), só as seções dos arquivos do cartão), as notas do pacote e as colas de biblioteca.

## Ferramentas do modelo
`list_files`, `read_file`, `search_code`, `read_rule`, `write_file`, `edit_file`, `replace_function`, `view_diff`, `run_check`, `web_search`, `fetch_page`, `ask_claude`, `finish`. Limites de tamanho por cartão e perfil saem de `cards.size_model(card, profile)`, inclusive linhas por chamada de `write_file`; não há número fixo.

## Verificação no `finish`
1. Prettier nos arquivos tocados (LI-052).
2. Escopo: nada alterado fora de `allowedPaths`; marcadores proibidos da política.
3. Em `implement`: frase `ESBOÇO` restante, linhas de código literais do `done`, duplicação.
4. Todos os checks do cartão (em `pre-review`, check vermelho é achado, não trava).
5. Em `pre-review`: uma linha por item do checklist, evidência que existe, e "ok" recusado quando o check citado no item (`run_check N`) está vermelho (LI-053).
6. Aprovado em `implement`: uma rodada de limpeza e nova verificação (`refactor: false` desliga).

Campos do cartão: ver [cartao-de-tarefa.md](../../docs/agents/cartao-de-tarefa.md).

## Travas extras (`gates.py`)
São ideias do [harness-toolkit](https://github.com/tech-leads-club/harness-toolkit), reescritas aqui; nenhum código foi copiado (a licença é Elastic 2.0).
- **Lacunas numeradas** (LI-044): o finish reprovado volta como uma lista; cada lacuna tem uma categoria e um próximo passo, e o aviso sobe de tom quando a mesma falha se repete. As categorias vão para `metrics.jsonl` (`failureCategories`).
- **Laço repetido** (LI-045): a mesma chamada 3 vezes seguidas recebe um aviso; na 5ª a execução falha.
- **Duplicação** (LI-046): no implement, 6+ linhas não triviais copiadas de outro arquivo reprovam o finish.
- **Segredos mascarados** (LI-047): a saída de checks e da web passa por `redact()` antes de chegar ao modelo e ao log.
- **Diff vazio** (LI-048): tarefa que pede escrita e não alterou nada não fica pronta.

## Política (Policy)
As restrições de segurança e limites são definidos em `policy.default.yaml`. Esta política pode ser sobrescrita por um arquivo localizado em `<repo>/.agents/policy.yaml`.

## Métricas
O histórico de execuções e métricas de uso é armazenado em `runs/metrics.jsonl`.

## SSH Gate
O script `scripts/alice-gate.sh` atua como um comando forçado para a chave SSH dedicada da Alice, permitindo apenas comandos do harness e inspeção de leitura. Em `~/.ssh/authorized_keys`:
`command="~/code/pilla/tools/alice-harness/scripts/alice-gate.sh",no-port-forwarding,no-agent-forwarding,no-pty ssh-ed25519 <chave da Alice>`

- `scripts/check-brave.sh` — testa a chave da API de busca do Brave.

## Perfis de modelo (`models.yaml`)
`ALICE_PROFILE=<perfil>` (ambiente prevalece sobre `.env`; sem ambos, usa `models.yaml:default`) escolhe modelo, `num_ctx`, `think` e amostragem.
O prompt de sistema é sempre o do harness, por isso o perfil usa o modelo-base, não um wrapper com SYSTEM.
`num_ctx` mínimo: 32768 (o harness compacta em ~90 mil caracteres, ~28 mil tokens, mais a saída).
As métricas registram `profile`, `model`, `outTokPerSec` e `promptTokPerSec`.
Calibragem (GPU de 12 GB, 32k): `gemma` ~135 tok/s; `qwen35` (6,5 GB) ~90; `qwen38` (2 bits, 9,6 GB) ~51; `gptoss` transborda a VRAM, ~30. Comparação com o harness: [docs/estudo/bancada-modelos.md](../../docs/estudo/bancada-modelos.md).

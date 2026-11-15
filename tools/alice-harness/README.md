# alice-harness

Ambiente de trabalho da Alice (modelo local no Ollama): executa as ferramentas que ela pede, com limites (leitura do repositório, escrita restrita, testes, busca em documentação oficial). Configuração em `.env` (ver `.env.example`).

## Comandos
- `alice.py run <task.yaml> --repo <path>`: Inicia uma tarefa.
- `alice.py resume <run_dir> --answer "<text>"`: Continua uma tarefa após uma interação com o Claude.
- `alice.py chat "<prompt>" [--file <path>]`: Pergunta direta ao modelo, sem uso de ferramentas.
- `alice.py rule <ID>... [--repo <path>]`: Exibe definições de regras (ex: RN-C03, T-13) a partir da documentação.
- `alice.py metrics`: Exibe um resumo das execuções registradas em `runs/metrics.jsonl`.

## Ferramentas (Tools)
As ferramentas disponíveis para a Alice incluem:
- `edit_file`: Edita arquivos no repositório.
- `view_diff`: Visualiza as mudanças feitas.
- `read_rule`: Lê definições de regras específicas.

## Campos do Card (Task Card)
Os cards de tarefa utilizam os seguintes campos:
- `kind`: Tipo da tarefa (ex: implement, test-author, docs).
- `rules`: IDs das regras (RN-C03, T-13…); o harness injeta só essas definições no pedido.
- `refactor`: `true`/`false`; em `implement` o padrão é `true` (rodada de limpeza + nova verificação após tudo verde).
- `think`: raciocínio estendido do modelo; padrão `false` (ligar só em lógica difícil).
- `maxOutputTokens`: Limite de tokens de saída.
- `lessons`: Lições aprendidas registradas no campo `finish`.

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
`ALICE_PROFILE=<perfil>` (env ou `.env`; padrão `gemma`) escolhe modelo, `num_ctx`, `think` e amostragem.
O prompt de sistema é sempre o do harness, por isso o perfil usa o modelo-base, não um wrapper com SYSTEM.
`num_ctx` mínimo: 32768 (o harness compacta em ~90 mil caracteres, ~28 mil tokens, mais a saída).
As métricas registram `profile`, `model`, `outTokPerSec` e `promptTokPerSec`.

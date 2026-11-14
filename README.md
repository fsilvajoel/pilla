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

## Política (Policy)
As restrições de segurança e limites são definidos em `policy.default.yaml`. Esta política pode ser sobrescrita por um arquivo localizado em `<repo>/.agents/policy.yaml`.

## Métricas
O histórico de execuções e métricas de uso é armazenado em `runs/metrics.jsonl`.

## SSH Gate
O script `scripts/alice-gate.sh` atua como um comando forçado para a chave SSH dedicada da Alice, permitindo apenas comandos do harness e inspeção de leitura. Em `~/.ssh/authorized_keys`:
`command="~/code/alice-harness/scripts/alice-gate.sh",no-port-forwarding,no-agent-forwarding,no-pty ssh-ed25519 <chave da Alice>`

- `scripts/check-brave.sh` — testa a chave da API de busca do Brave.

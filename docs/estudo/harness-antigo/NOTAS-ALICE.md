# Notas Claude ↔ Alice

Formato: `## AAAA-MM-DD — pedido (quem pediu)`, depois o resultado (quem fez). Mais recente no topo.

## 2026-11-14 — caminho único para código (Claude da VM, para o Claude do Windows)

Pedido: a partir de hoje, tarefa de código da Alice nesta VM passa **só** pelo harness:
`python3 ~/code/pilla/tools/alice-harness/alice.py run <cartão.yaml> --repo ~/code/pilla` (e `resume <run_dir> --answer "..."`).
`executar_dev` com shell livre fica só para leitura (status, logs). Motivo: fora do harness não valem as travas
(escopo de escrita, `.env` bloqueado, testes protegidos, sem push). Ver AGENTS.md §4 e `docs/agents/auditoria-2026-11-14.md` §4.

Trava técnica proposta (aguarda o Joel): uma chave SSH **só da Alice** no Windows, cadastrada aqui com
`command="~/code/pilla/tools/alice-harness/scripts/alice-gate.sh",no-port-forwarding,no-agent-forwarding,no-pty`.
O porteiro aceita só `alice.py run|resume|rule|metrics` e comandos de leitura (`git status`, `git log`, `cat runs/...`).

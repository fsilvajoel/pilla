# estado.json de uma feature

Arquivo que o motor grava e lê para retomar a feature. **Ninguém edita à mão**, nem para subir orçamento.

> Nomes de campo por papel. O motor externo ainda grava os nomes antigos, ligados ao executor; ao migrar o motor,
> use os nomes abaixo. Até lá, leia o campo antigo equivalente pela mesma posição no JSON.

```json
{
  "feature": "E4-F04",
  "stages": {
    "plan":      {"status": "done", "seconds": 0, "problems": []},
    "tests":     {"status": "done", "reviewerRequests": 1, "reviewerIn": 2943, "reviewerOut": 1541, "seconds": 25, "repairs": 0},
    "implement": {"status": "done", "seconds": 64, "developerTokens": {"prompt": 108180, "output": 1337},
                  "cards": {"E4-T09": "done"}},
    "audit":     {"status": "done", "reviewerRequests": 1, "verdict": "aprovado", "gaps": 0,
                  "extraTests": [], "checksGreen": true},
    "review":    {"status": "ready", "seconds": 11}
  },
  "reviewerRequests": 2,
  "testShas": {"src/log/redact-prototype.test.ts": "eb4282ab..."},
  "expectRed": true,
  "scenarios": [{"id": "C9", "descricao": "...", "card": "E4-T08", "teste": "..."}]
}
```

## Campos
- `stages.<etapa>.status`: `pending`, `running`, `done`, `ready` (pronto para a próxima etapa) ou um estado de falha.
- `reviewerRequests`, `reviewerIn`/`reviewerOut`: requisições e tokens do papel reviewer (serviço com cota).
- `developerTokens`: tokens do papel developer; `cards`: status de cada cartão de implementação.
- `testShas`: sha do blob de cada teste revisado; se mudar, a revisão cai.
- `expectRed`: os testes falharam contra o esboço antes da implementação.
- `scenarios`: ligação cenário → cartão → nome do teste.

## Estados de falha
| Estado | Significado | O que fazer |
|---|---|---|
| `quota` | acabou a cota do serviço externo | esperar a cota; não subir orçamento |
| `card_error` | o pré-voo recusou o cartão | corrigir o cartão (skill [escrever-cartao](../../skill/escrever-cartao/SKILL.md)) |
| `needs_input` | o agente pediu decisão humana | responder e retomar |
| `failed` | esgotou tentativas | classificar: cartão, harness ou modelo |
| `error` | gate falhou (ex.: cobertura ausente, vazia 0/0 ou check vermelho) | ver a mensagem; não é sucesso |

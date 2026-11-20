# Refinamento funcional E9-F01

refinador: refiner
rodada: 1

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato.
- [x] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam para escrever os testes e
      implementar sem adivinhar.

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E9-T01 | ajustado | ajustado |

## Veredito
ajustado

## Mudanças
- docs/plano/E9.yaml (E9-T01): `skills` sem `editar-arquivo`, que o papel implementer já injeta (fonte: `cartao.md`, tabela de skills; `role_skills`).
- docs/plano/E9.yaml (E9-T01): hint do `--env-file` entre aspas simples; o `": "` dentro dele quebrava o YAML (fonte: validação `yaml.safe_load`).
- docs/plano/E9.yaml (E9-T01, A2, A3): checks de `db:migrate` e `db:seed` rodam duas vezes seguidas, para o check provar a idempotência citada no done (fonte: plano, C4 e C7).
- Decisões P1 a P4 conferidas no done e nos hints, sem mudança.

## Pendências de PM
- nenhuma

## Segunda opinião (pepe, 19/11)
- veredito do pepe: aprovado (sem apontar os problemas abaixo; a revisão anterior os tinha apontado).
- ressalvas aplicadas no plano e no cartão: tabela de `POSTGRES_PORT` (1024 é regra documentada, o compose só recusa não numérico e acima de 65535); seed com 6 pessoas e fonte explícita para a quantidade; principal exatamente 1 por pessoa, inclusive quem tem um só; cenários de erro conferidos pelo reviewer (checks do cartão cobrem só o caminho feliz); `@types/pg` em `docs/travas.md` (Dev).
- `estado.json` mantém só as etapas já executadas; `tests`, `testReview`, `implement` e `review` entram quando começarem.

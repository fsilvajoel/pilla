# E14-F07: e2e de login e sessão nos e2e existentes

Plano da feature. Cartão: E14-T12 (testes). Referências: PRD-001 RN-A03 e RN-A05, ADR-0011, `docs/plano/E14.md` D9, D12 e D13.

## Escopo

Entra:
- `apps/web/e2e/global-setup.ts`: gera senha aleatória em tempo de execução, cria o admin com `db:seed-admin` (senha pelo stdin), faz login pela tela e grava o `storageState` em `e2e/.auth/` (ignorado pelo git).
- `apps/web/playwright.config.ts`: `globalSetup` e `storageState` padrão.
- `apps/web/e2e/auth.e2e.ts`: rota protegida, senha errada e logout (sem `storageState`).
- e2e existentes: só passam a usar o `storageState`; se algum mock de API precisar, acrescenta a resposta de `/auth/me`.

Fora: teste de carga do limite de tentativas (coberto na F02); portal do cliente.

## Domínio das entradas

| Situação | Esperado | Fonte |
|---|---|---|
| sem sessão em `/pessoas` | vai para `/login?next=%2Fpessoas` | D12 |
| login certo vindo de `next` | volta a `/pessoas` | D12 |
| senha errada | "Usuário ou senha inválidos.", fica em `/login`, sem cookie | D5 |
| "Sair" e voltar a `/pessoas` | pede login de novo | D12 |

## Critérios de aceite
- A1: `globalSetup` cria o admin e a sessão sem senha fixa em arquivo.
- A2: rota protegida redireciona e volta após o login.
- A3: senha errada mostra o erro e não cria cookie.
- A4: "Sair" encerra a sessão.
- A5: todos os e2e existentes passam com o `storageState`.

## Casos de teste
- `apps/web/e2e/auth.e2e.ts`: C1 (rota protegida e volta), C2 (senha errada), C3 (logout).
- e2e existentes: inalterados no que testam.

## Riscos
- O banco do e2e precisa ser local (o `db:seed-admin` recusa outro host); é o mesmo banco da API na porta 3101.
- Login repetido nos e2e pode esbarrar no limite de 5 por minuto: o login é feito uma vez no `globalSetup`; `auth.e2e.ts` faz no máximo três.

## Dependências
F04 (ator real), F05 (seed) e F06 (tela).

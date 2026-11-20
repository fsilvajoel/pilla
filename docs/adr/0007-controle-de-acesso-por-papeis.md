# ADR-0007 — Controle de acesso por papéis (ADMIN e CLIENTE)

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) RN-A |

## Contexto
Haverá dois públicos: o gerenciador (tudo) e o cliente (só os próprios contratos, só leitura). Dados pessoais e financeiros exigem isolamento rigoroso.

## Decisão
- Módulo **M6 Acesso** dono de Usuário, Papel, AcessoPortal, Sessão e RegistroAcesso.
- Papéis no MVP: **ADMIN** e **CLIENTE**. Permissões definidas por papel em um único lugar (não espalhadas em `if`s).
- Acesso CLIENTE é vinculado a uma Pessoa; **toda consulta** do portal é filtrada no servidor pela Pessoa identificada no acesso (nunca por id vindo do navegador).
- Portal do cliente usa consultas próprias que expõem só os campos permitidos (RF-62/63); nunca reaproveita a resposta do ADMIN.
- Mecanismo de autenticação de cada papel: [ADR-0011](0011-autenticacao-cpf-senha-sessao.md).

## Consequências
- Novos papéis (ex.: operador, sócio) entram sem mudar os módulos de negócio.
- Testes obrigatórios de isolamento (CA-09).

## Alternativas consideradas
- **Mesma tela com campos ocultos**: alto risco de vazamento.

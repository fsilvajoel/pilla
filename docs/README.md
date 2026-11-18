# Documentação do pilla

O pilla é um **produto de estudo**: um sistema de gestão de empréstimos usado para provar conceitos de arquitetura escalável e sólida. Toda decisão fica escrita **antes** do código, e os agentes que constroem o código se guiam por estes documentos.

## Tipos de documento

| Tipo | Pasta | Responde | Quem decide |
|---|---|---|---|
| **PRD** (Product Requirements Document) | [prd/](prd/) | *O quê* e *por quê*: problema, usuários, escopo, regras de negócio, critérios de aceite | Joel (dono do produto) |
| **RFC** (Request for Comments) | [rfc/](rfc/) | *Como* (proposta técnica detalhada, aberta a discussão) | discutida; aprovada pelo Joel |
| **ADR** (Architecture Decision Record) | [adr/](adr/) | *Qual decisão* arquitetural foi tomada, por quê e com que consequências | aceita pelo Joel |
| **Legal** | [legal/](legal/) | Pontos jurídicos/regulatórios anotados, separados do produto | — |

Fluxo: **PRD** define a necessidade → **RFC** propõe a solução → as decisões estruturais da RFC viram **ADRs** curtas e definitivas.

## Regras para agentes construtores de código

> O guia completo (fluxo TDD, travas, papéis, definição de pronto) está em [AGENTS.md](../AGENTS.md); travas em [travas.md](travas.md), processo dos agentes em [harness Ada](../../harness-ada/README.md) e memória curada em [docs/memoria/](memoria/README.md).

1. **Antes de implementar, leia**: o PRD vigente, as RFCs relacionadas e **todas as ADRs com status `Aceito`**.
2. Implemente só o que está em PRD/RFC com status `Aprovado` e ADR `Aceito`. Status `Proposto`/`Em discussão` = não implementar; perguntar.
3. **Cite os IDs** nos commits e PRs (ex.: `RN-C05`, `ADR-0003`).
4. Encontrou conflito ou lacuna? **Não decida sozinho**: registre em uma RFC (nova ou existente) e pergunte.
5. Uma ADR aceita **não é editada**; se a decisão mudar, cria-se uma nova ADR que a **substitui** (`Substituída por ADR-XXXX`).
6. **Nomes no código em inglês**, conforme o [glossário](glossario.md); documentação e comentários em pt-BR ([ADR-0012](adr/0012-idioma-codigo-ingles-docs-portugues.md)).
7. Respeite as fronteiras de domínio ([RFC-001](rfc/RFC-001-dominios-e-integracao.md)): um módulo nunca grava dados de outro.

## Índice

### PRD
- [PRD-001 — MVP de gestão de empréstimos](prd/PRD-001-mvp-gestao-emprestimos.md) · Aprovado

### RFC
- [RFC-001 — Domínios, modelo e integração entre módulos](rfc/RFC-001-dominios-e-integracao.md) · Aprovado
- [RFC-002 — Motor de cálculo financeiro](rfc/RFC-002-motor-de-calculo-financeiro.md) · Aprovado
- [RFC-003 — Stack tecnológica](rfc/RFC-003-stack-tecnologica.md) · Aprovado
- [RFC-004 — Contrato da API e catálogo de eventos](rfc/RFC-004-api-e-eventos.md) · Aprovado
- [RFC-005 — Modelo físico do banco](rfc/RFC-005-modelo-fisico-banco.md) · Aprovado

### ADR
| # | Decisão | Status |
|---|---|---|
| [0001](adr/0001-registrar-decisoes-em-adr-rfc-prd.md) | Registrar decisões em PRD, RFC e ADR | Aceito |
| [0002](adr/0002-monolito-modular.md) | Monólito modular com fronteiras de domínio | Aceito |
| [0003](adr/0003-eventos-de-dominio-com-outbox.md) | Integração entre módulos por eventos de domínio com outbox | Aceito |
| [0004](adr/0004-dinheiro-em-centavos.md) | Dinheiro em centavos inteiros; taxas em decimal | Aceito |
| [0005](adr/0005-valores-derivados.md) | Valores derivados não são fonte da verdade | Aceito |
| [0006](adr/0006-registros-imutaveis-e-auditoria.md) | Registros financeiros imutáveis e auditoria | Aceito |
| [0007](adr/0007-controle-de-acesso-por-papeis.md) | Controle de acesso por papéis (ADMIN e CLIENTE) | Aceito |
| [0008](adr/0008-condicoes-congeladas-no-contrato.md) | Condições congeladas no contrato | Aceito |
| [0009](adr/0009-funcionalidades-opcionais-como-modulos.md) | Funcionalidades opcionais como módulos plugáveis | Aceito |
| [0010](adr/0010-stack-typescript-ponta-a-ponta.md) | TypeScript ponta a ponta (NestJS, Next.js, PostgreSQL) em monorepo | Aceito |
| [0011](adr/0011-autenticacao-cpf-senha-sessao.md) | Acesso do cliente só por CPF (leitura) e do ADMIN por login e senha | Aceito |
| [0012](adr/0012-idioma-codigo-ingles-docs-portugues.md) | Código em inglês, documentação em português | Aceito |
| [0013](adr/0013-estado-no-frontend.md) | Gerenciamento de estado no frontend | Aceito |
| [0014](adr/0014-orquestracao-por-feature.md) | Orquestração dos agentes por feature | Substituída por ADR-0015 |
| [0015](adr/0015-harness-ada-externo-agnostico.md) | Harness Ada externo e agnóstico ao modelo | Aceito |

### Glossário
- [Glossário português → código](glossario.md) — nomes obrigatórios no código

### Legal
- [Pontos legais e regulatórios](legal/pontos-legais.md)

## Modelos
- [Modelo de ADR](adr/_modelo.md) · [Modelo de RFC](rfc/_modelo.md)

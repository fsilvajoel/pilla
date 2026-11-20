# RFC-001 — Domínios, modelo e integração entre módulos

| Campo | Valor |
|---|---|
| Status | Aprovado |
| Autor | Claude (tech lead) |
| Criado | 2026-11-14 |
| Implementa | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) |
| Gera ADRs | [0002](../adr/0002-monolito-modular.md), [0003](../adr/0003-eventos-de-dominio-com-outbox.md), [0005](../adr/0005-valores-derivados.md), [0006](../adr/0006-registros-imutaveis-e-auditoria.md), [0007](../adr/0007-controle-de-acesso-por-papeis.md), [0009](../adr/0009-funcionalidades-opcionais-como-modulos.md) |

---

> **Nomes:** este documento usa os termos do negócio em português. No código, use os nomes em inglês do [glossário](../glossario.md) ([ADR-0012](../adr/0012-idioma-codigo-ingles-docs-portugues.md)).

## 1. Objetivo

Definir os domínios (módulos) do sistema, quem é dono de cada dado, como os módulos conversam e o que pode ser reusado, para que o projeto cresça em módulos sem conflitos e sem reescrita.

## 2. Mapa de domínios

```
              ┌──────────────────────────────────────┐
              │ M0 Núcleo compartilhado (kernel)       │
              │ Dinheiro · Taxa · Datas · Anexos ·     │
              │ Auditoria · Eventos · Cálculo (RFC-002)│
              └──────────────────────────────────────┘
                         ▲ usado por todos
┌────────────┐   ┌────────────┐   ┌───────────────┐
│ M1 Pessoas │◄──│ M2 Crédito │◄──│ M3 Recebimento│
└────────────┘   └────────────┘   └───────────────┘
      ▲                │ eventos          │ eventos
      │                ▼                  ▼
      │          ┌──────────────────────────────┐
      │          │ M4 Tesouraria                 │
      │          └──────────────────────────────┘
┌────────────┐
│ M6 Acesso  │  (identidade, papéis; vincula Usuário → Pessoa)
└────────────┘
┌──────────────────────┐
│ Portal do cliente     │  camada de leitura: consulta M1–M3 via interfaces públicas
└──────────────────────┘
Futuro: M5 Risco (Score), Cobrança, Relatórios → só ouvem eventos (ADR-0009)
```

### Dono e fronteiras

| Módulo | É dono de | Pode depender de | Nunca |
|---|---|---|---|
| **M0 Núcleo** | tipos de valor, funções puras, infraestrutura de eventos/auditoria/anexos | nada | conter regra específica de empréstimo além das funções de cálculo |
| **M1 Pessoas** | Pessoa, Endereço, ChavePix | M0 | conhecer contratos |
| **M2 Crédito** | Contrato, Parcela, Parâmetros de encargo | M0, M1 (por id) | registrar dinheiro recebido |
| **M3 Recebimentos** | Pagamento, Alocação | M0, M2 (interface pública) | alterar contrato diretamente |
| **M4 Tesouraria** | Conta, Movimentação | M0; ouve M2 e M3 | alterar contratos ou pagamentos |
| **M6 Acesso** | Usuário, Papel, Sessão, AcessoPortal, RegistroAcesso | M0, M1 (por id) | conter regra financeira |
| **Portal** | nada (só lê) | interfaces de consulta de M1–M3 | gravar |

**Regra de dependência:** só no sentido das setas. Sentido contrário = **evento**. Um módulo só acessa outro pela sua **interface pública** (serviço/consulta exportados), nunca pelas tabelas.

## 3. Modelo de dados por módulo

> Campos marcados *(calc)* não são armazenados como fonte da verdade ([ADR-0005](../adr/0005-valores-derivados.md)).

### M0 — tipos compartilhados
- **Dinheiro**: inteiro em centavos + moeda (BRL) ([ADR-0004](../adr/0004-dinheiro-em-centavos.md)).
- **Taxa**: decimal (4 casas) + periodicidade (`AO_MES`).
- **RegraVencimento**: `{primeiro_vencimento, unidade: DIA | MES, intervalo: n}` (ex.: a cada 7 dias, a cada 2 meses). Extensível para `DIAS_FIXOS([d1,d2])` no futuro.
- **Taxa**: sempre **ao mês** (PRD RN-C02); proporcional ao intervalo das parcelas.
- **Anexo**: id, nome, tipo MIME, tamanho, hash SHA-256, armazenamento, enviado_por, data.
- **RegistroAuditoria**: entidade, id, ação, antes, depois, usuário, data.

### M1 — Pessoas
**Pessoa**: id, nome, cpf (único, só dígitos), telefone, email, data_nascimento, indicado_por_id (→ Pessoa), observacoes, ativo, criado_em.
**Endereco**: id, pessoa_id, logradouro, numero, complemento, bairro, cidade, uf, cep, principal.
**ChavePix**: id, titular_id (→ Pessoa), tipo (CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA), valor, principal.
> ChavePix é reusada pela Tesouraria (conta base), sem duplicar o conceito.

### M2 — Crédito
**Contrato**: id, numero (ex.: 2026-0012), pessoa_id, modalidade, principal, taxa_juros, numero_parcelas, regra_vencimento (1º vencimento + unidade + intervalo, negociados), data_contratacao, data_desembolso, conta_id, contrato_origem_id, tipo_origem (RENOVACAO, RENEGOCIACAO, IMPORTACAO), status, multa_pct, mora_pct_mes, carencia_dias, observacoes_internas.
*(calc)* total_a_receber, total_pago, saldo_devedor, situacao, dias_em_atraso, encargos_atuais.

**Parcela**: id, contrato_id, numero, vencimento, valor_principal, valor_juros, valor_total.
*(calc)* status: `ABERTA`, `PARCIAL`, `PAGA`, `VENCIDA`, `VENCIDA_PARCIAL`; valor_pago; encargos.

**ParametrosPadrao** (formulário RF-40): multa_pct, mora_pct_mes, carencia_dias, taxa_sugerida, vigente_desde. Copiados para o contrato na criação ([ADR-0008](../adr/0008-condicoes-congeladas-no-contrato.md)).

**Modalidades:** `PARCELADO_JUROS_SIMPLES`, `PARCELA_UNICA`, `SO_JUROS`, `PERSONALIZADO` (cálculos em [RFC-002](RFC-002-motor-de-calculo-financeiro.md)).

**Ciclo de vida:**
```
RASCUNHO ──ativar──► ATIVO ──saldo = 0──► QUITADO
   │                   ├──renovar──────► RENOVADO      (+ novo contrato)
   │                   ├──renegociar───► RENEGOCIADO   (+ novo contrato)
   │                   └──baixar───────► BAIXADO_PERDA
   └──cancelar──► CANCELADO
```
"Em atraso" é **situação calculada**, não status.

### M3 — Recebimentos
**Pagamento**: id, contrato_id, data_pagamento, valor, metodo (PIX, BOLETO, ESPECIE, TRANSFERENCIA), comprovante_id (→ Anexo), id_transacao_pix (opcional; evita registrar o mesmo comprovante duas vezes), canal_origem (ADMIN, futuro WHATSAPP), conta_id, status (`PENDENTE_CONFERENCIA` → `CONFIRMADO` → `ESTORNADO`), motivo_estorno, observacoes.
**Alocacao**: id, pagamento_id, parcela_id, valor_encargos, valor_juros, valor_principal, estornada.

### M4 — Tesouraria
**Conta**: id, nome, chave_pix_id (→ ChavePix), descricao, limite_comprometido_pct (opcional), ativa.
**Movimentacao** (append-only): id, conta_id, tipo (APORTE, RETIRADA, DESEMBOLSO, RECEBIMENTO, ESTORNO, AJUSTE), valor (com sinal), componente (PRINCIPAL, JUROS, ENCARGOS, —), referencia (tipo + id de origem), data, justificativa.
*(calc)* saldo_em_caixa, capital_emprestado, capital_total, pct_comprometido, pct_disponivel, juros_recebidos, previsao_mes.

### M6 — Acesso
**Usuario** (ADMIN): id, login, senha (hash argon2id), papel, ativo, ultimo_acesso.
**AcessoPortal** (CLIENTE): pessoa_id, habilitado, habilitado_em, habilitado_por. O CPF da Pessoa é a chave de acesso (RN-A04); não há senha.
**RegistroAcesso**: data, ip, cpf consultado (hash), resultado — base para limite por IP e investigação.

## 4. Integração por eventos

Publicados pela **outbox transacional** na mesma transação da mudança ([ADR-0003](../adr/0003-eventos-de-dominio-com-outbox.md)). Consumidores devem ser **idempotentes** (mesmo evento duas vezes = mesmo efeito).

| Evento | Publicado por | Consumido por | Efeito |
|---|---|---|---|
| `ContratoAtivado` | M2 | M4 | movimentação DESEMBOLSO |
| `ContratoQuitado` | M2 | M4 (indicadores) | — |
| `ContratoRenovado` / `ContratoRenegociado` | M2 | M4 | — |
| `ContratoBaixado` | M2 | M4 | indicador de perda |
| `PagamentoConfirmado` | M3 | M2, M4 | M2 reavalia quitação; M4 lança RECEBIMENTO por componente |
| `PagamentoEstornado` | M3 | M2, M4 | reversão |
| `ParcelaVencida` | rotina diária (M2) | futuros: Cobrança, Risco | — |

Formato mínimo: `id`, `tipo`, `versao`, `ocorrido_em`, `agregado_id`, `dados`.
Eventos são **contrato público**: mudar o formato = nova versão, nunca quebrar consumidores.

## 5. Comandos x consultas

- **Comandos** (alteram estado) passam pelo módulo dono e são auditados.
- **Consultas** podem usar visões de leitura (*read models*) otimizadas, desde que reconstruíveis a partir dos fatos ([ADR-0005](../adr/0005-valores-derivados.md)). O Portal do cliente e o Painel do ADMIN são consultas.

## 6. Reúso (o que **não** pode ser reescrito)

| Necessidade | Única implementação |
|---|---|
| Qualquer conta com dinheiro | M0 Dinheiro |
| Juros, parcelas, encargos, distribuição de pagamento | M0 Cálculo ([RFC-002](RFC-002-motor-de-calculo-financeiro.md)) — usado pela simulação, pelo contrato, pelo portal e pela importação |
| Datas de vencimento | M0 Datas/RegraVencimento |
| Arquivos (comprovante, contrato assinado) | M0 Anexo |
| Trilha de alterações | M0 Auditoria |
| Chave PIX | M1 ChavePix (pessoas e contas) |
| Pessoa (cliente, indicador, usuário) | M1 Pessoa |

## 7. Canais de atendimento (preparação para WhatsApp)

O próximo módulo previsto é um **atendimento por WhatsApp** (bot): o cliente pergunta o status e envia comprovantes. Para ele entrar sem alterar o núcleo:

- **Regras ficam nos módulos de domínio, nunca no canal.** Portal, WhatsApp e futuros canais chamam os **mesmos** comandos e consultas públicos (ex.: `consultarSituacaoDoCliente`, `registrarPagamentoPendente`).
- Futuro módulo **M7 Atendimento**: dono de Conversa, Mensagem e vínculo telefone → Pessoa. Depende de M1 (identificar pelo telefone), M2/M3 (interfaces públicas) e M0 (Anexo para a imagem do comprovante).
- Comprovante recebido pelo bot → extração automática (valor, data, pagador, identificador da transação PIX) → `registrarPagamentoPendente` em M3 com status `PENDENTE_CONFERENCIA` (RN-R01). A **baixa automática** vira uma regra de confirmação em M3 (ex.: confirmar sozinho quando valor e identificador da transação batem), não lógica do bot.
- Mensagens ativas (lembrete de vencimento, confirmação de baixa) = consumidores de eventos (`ParcelaVencida`, `PagamentoConfirmado`).
- Já no MVP: a consulta de situação do portal é escrita como **consulta pública reutilizável** (não dentro da página), e o identificador da transação PIX é um campo opcional do Pagamento.

## 8. Alternativas consideradas

- **Microsserviços desde o início**: descartado no MVP (custo operacional sem ganho); as fronteiras de módulo permitem extrair depois ([ADR-0002](../adr/0002-monolito-modular.md)).
- **Chamadas diretas entre módulos para efeitos colaterais**: descartado, acopla e impede módulos plugáveis.
- **Entidade "Cliente" separada de "Pessoa"**: descartado, duplicaria dados para indicador/usuário.

## 9. Questões abertas

- Armazenamento de anexos → proposta em RFC-003 (S3-compatível).

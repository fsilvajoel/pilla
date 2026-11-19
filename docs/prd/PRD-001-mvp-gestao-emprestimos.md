# PRD-001 — MVP de gestão de empréstimos

| Campo | Valor |
|---|---|
| Status | Aprovado |
| Dono | Joel |
| Criado | 2026-11-14 |
| Relacionados | [RFC-001](../rfc/RFC-001-dominios-e-integracao.md), [RFC-002](../rfc/RFC-002-motor-de-calculo-financeiro.md), [Legal](../legal/pontos-legais.md) |

---

## 1. Contexto e problema

Hoje os empréstimos são controlados em uma planilha (mantida **fora** do repositório, por conter dados pessoais). Nela, valores como saldo, total e situação são digitados à mão, o que gerou:

- saldo positivo em algumas linhas e negativo em outras;
- total que não bate com a taxa informada (3.000 × 10% × 4 = 4.200, mas a planilha registra 4.000);
- renovações ("re-emprestado") registradas repetindo a linha a cada mês, sem vínculo entre elas;
- vencimento em texto livre ("Dia 15", "10 e 30", "início mês");
- valor recebido como um número único, sem saber quando, como e com que comprovante cada valor entrou;
- situação expressa por cor da linha e por observações ("3 de 6", "quitado em 02/10").

O cliente não tem como consultar a própria situação sem perguntar.

## 2. Objetivo

1. **Produto:** gerenciar empréstimos de ponta a ponta (clientes, contratos, parcelas, pagamentos, capital) com números sempre corretos e rastreáveis, e dar ao cliente uma visão clara do próprio contrato.
2. **Estudo:** servir de prova de conceito de arquitetura escalável e sólida: domínios bem separados, reúso máximo, decisões documentadas (ver [ADR-0001](../adr/0001-registrar-decisoes-em-adr-rfc-prd.md)).

**Princípio:** o sistema guarda **fatos** (contrato firmado, pagamento recebido, aporte feito). Tudo que é **consequência** (saldo, atraso, encargos, % comprometido, status de parcela) é **calculado** ([ADR-0005](../adr/0005-valores-derivados.md)).

## 3. Usuários (personas)

| Papel | Quem | Precisa |
|---|---|---|
| **ADMIN** (gerenciador) | Joel / operador | cadastrar, emprestar, registrar pagamentos, ver capital e atrasos |
| **CLIENTE** | tomador do empréstimo | ver **só os próprios** contratos: datas, valores, parcelas, o que pagou, o que falta, se está atrasado |

## 4. Escopo

### No MVP
- Cadastro de pessoas, endereços, chaves PIX e indicação.
- Contratos nas modalidades: parcelado com juros simples, parcela única, só juros, personalizado (para histórico).
- Vencimento: 1º vencimento + periodicidade (a cada N dias ou N meses) negociados.
- Encargos de atraso (multa + juros de mora) **configuráveis em formulário**.
- Renovação (sem limite de renovações).
- Quitação antecipada **sem desconto**.
- Pagamentos com método, comprovante, conferência e estorno.
- Conta base (tesouraria) com extrato e indicadores.
- Portal do cliente (somente leitura).
- Importação do histórico da planilha.

### Fora do MVP (futuro)
| Item | Observação |
|---|---|
| **Score / risco** | módulo à parte, plugável por eventos ([ADR-0009](../adr/0009-funcionalidades-opcionais-como-modulos.md)) |
| Datas fixas irregulares no mês (ex.: sempre dia 10 e dia 30) | coberto em parte por "a cada 15 dias"; datas fixas exatas ficam para depois |
| Desconto em quitação antecipada | |
| Limite de renovações | |
| **Atendimento por WhatsApp** (bot): cliente consulta status, envia comprovante e o pagamento é registrado automaticamente | próximo módulo previsto; arquitetura já preparada (RFC-001 §9, RFC-003 §5) |
| Cobrança automática (lembretes), boleto/integração bancária | |
| Cliente enviar comprovante pelo portal | |
| Um pagamento cobrindo vários contratos | |
| Relatórios avançados | |
| **v1.1** Tela do ADMIN "atualização de pagamento por contrato": dados do cliente, lista de pagamentos do contrato, check "assinado pelo admin", upload/visualização do comprovante e "atualizado em" automático exibido no portal | intenção e pendências em [decisoes-2026-11-19](../plano/decisoes-2026-11-19.md); no MVP vale a E7-F04 (form simples) |

## 5. Requisitos funcionais

IDs estáveis: agentes devem citá-los em commits/PRs.

### Pessoas
- **RF-01** ADMIN cadastra/edita pessoa (nome, CPF, telefone, e-mail, nascimento, observações).
- **RF-02** ADMIN cadastra endereços (um principal) e chaves PIX (uma principal).
- **RF-03** ADMIN registra quem indicou a pessoa.
- **RF-04** ADMIN vê a ficha da pessoa: contratos, pagamentos, situação, indicados.

### Contratos
- **RF-10** ADMIN **simula** um empréstimo (principal, taxa, nº de parcelas, modalidade, data do 1º vencimento e periodicidade negociadas) e vê total, parcelas e cronograma, sem gravar.
  - Esboço da tela (MVP, simples): [telas/simulacao-contrato.png](telas/simulacao-contrato.png)
- **RF-11** ADMIN cria contrato a partir da simulação (status RASCUNHO).
- **RF-12** ADMIN ativa o contrato registrando o desembolso (data e conta de origem).
- **RF-13** ADMIN renova contrato (paga juros do período, principal segue em novo contrato).
- **RF-14** ADMIN renegocia contrato (novas condições em novo contrato).
- **RF-15** ADMIN registra quitação antecipada (valor = saldo devedor integral).
- **RF-16** ADMIN baixa contrato como perda (com justificativa).
- **RF-17** ADMIN cancela contrato em RASCUNHO.
- **RF-18** ADMIN vê cronograma com situação de cada parcela e encargos calculados.

### Recebimentos
- **RF-20** ADMIN registra pagamento: contrato, data, valor, método (PIX, BOLETO, ESPÉCIE, TRANSFERÊNCIA), comprovante, conta de destino.
- **RF-21** ADMIN confere e confirma pagamento pendente.
- **RF-22** ADMIN estorna pagamento confirmado (com justificativa).
- **RF-23** Ao registrar, o sistema mostra como o valor será distribuído (encargos, juros, principal, por parcela) antes de confirmar.

### Tesouraria
- **RF-30** ADMIN registra aporte, retirada e ajuste (ajuste exige justificativa).
- **RF-31** ADMIN vê extrato da conta.
- **RF-32** ADMIN vê painel: caixa, capital emprestado, % comprometido, % disponível, juros recebidos, previsão de recebimento do mês.

### Parâmetros
- **RF-40** ADMIN edita, em formulário, os **parâmetros padrão**: multa por atraso (%), juros de mora (% ao mês), dias de carência, taxa de juros sugerida, passo de arredondamento (padrão R$ 5).
- **RF-41** No formulário de contrato, os parâmetros vêm preenchidos com o padrão e podem ser ajustados **antes da ativação**.

### Painel do dia (ADMIN)
- **RF-50** Parcelas vencendo hoje e na semana; parcelas atrasadas (com dias e encargos); pagamentos pendentes de conferência.

### Portal do cliente
- **RF-60** ADMIN habilita/desabilita o acesso de um cliente ao portal.
- **RF-61** CLIENTE informa **apenas o CPF** e vê a lista dos seus contratos com situação (em dia / em atraso / quitado). Página **somente leitura**.
- **RF-62** CLIENTE vê, por contrato: valor emprestado, total a pagar, total pago, saldo, próxima parcela (data e valor), todas as parcelas com status, pagamentos registrados (data, valor, método) e encargos, se houver atraso.
- **RF-63** CLIENTE **não** vê: dados de outros clientes, observações internas, tesouraria, parâmetros, auditoria. Como o acesso é só por CPF, o portal também **não exibe** dados pessoais sensíveis: endereço, telefone, e-mail, chaves PIX, CPF completo (mascarado) e comprovantes.
- **RF-64** Linguagem simples e direta (ex.: "Próxima parcela: R$ 1.149,83 em 15/12/2026").

### Importação
- **RF-70** Importar a planilha histórica: cada linha → Pessoa + Contrato (+ pagamentos consolidados). Linhas inconsistentes entram como PERSONALIZADO numa lista "a revisar".

## 6. Regras de negócio

### Pessoas (RN-P)
- **RN-P01** CPF único e válido. Pode ficar pendente apenas em registros importados.
- **RN-P02** Indicador é uma Pessoa cadastrada; ninguém indica a si mesmo.
- **RN-P03** Cliente **não é entidade separada**: cliente = Pessoa com ao menos um contrato. Indicador, cliente e usuário apontam para a mesma Pessoa.
- **RN-P04** Pessoa com contrato ATIVO não pode ser desativada.

### Contratos (RN-C)
- **RN-C01** Total, valor de parcela, saldo e situação são **sempre calculados** ([RFC-002](../rfc/RFC-002-motor-de-calculo-financeiro.md)); nunca digitados.
- **RN-C02** Juros **simples, sobre o principal, com taxa sempre ao mês**, proporcional ao intervalo das parcelas: `total = principal × (1 + taxa_mensal × n × fator)`, onde `fator` = intervalo em meses, ou intervalo em dias ÷ 30. Em contrato mensal, `fator = 1` (igual à planilha). A tela mostra também a taxa equivalente do período (ex.: 10% a.m. → 2,33% por semana).
- **RN-C03** **Arredondamento para múltiplo de R$ 5, para o mais próximo** (empate sobe), em dois passos:
  1. o total de juros calculado é arredondado (93,33 → 95);
  2. o valor da parcela `(principal + juros) ÷ n` é arredondado (273,75 → 275).
  - Todas as parcelas ficam iguais e redondas; **total do contrato = parcela × n**, e os juros efetivos = total − principal.
  - Vale também para os encargos de atraso (multa + mora) e para os juros do período na modalidade só juros.
  - **Não** se aplica a valores efetivamente pagos nem à tesouraria (dinheiro real é registrado como entrou).
  - O passo (R$ 5) é um parâmetro padrão (RF-40), copiado para o contrato (ADR-0008).
- **RN-C04** Vencimento: na negociação o ADMIN define a **data do 1º vencimento** e a **periodicidade** das parcelas, em **dias** (ex.: a cada 7, 15 ou 30 dias) ou em **meses** (ex.: a cada 1 ou 2 meses).
  - Em meses: mesmo dia do mês; dia inexistente (ex.: 31) → último dia do mês.
  - Em dias: soma exata de dias corridos.
  - A data do 1º vencimento deve ser posterior à data de desembolso.
  - A tela pode usar um componente de calendário para escolher/visualizar as datas (UX em aberto — PEND-06).
- **RN-C05** Contrato só fica ATIVO com desembolso registrado.
- **RN-C06** Contrato ATIVO **não é editado**; mudança = renegociação (novo contrato vinculado).
- **RN-C07** Renovação: exige juros do período pagos; contrato atual → RENOVADO; novo contrato com o mesmo principal (ou ajustado) vinculado ao anterior. Sem limite no MVP.
- **RN-C08** Quitação antecipada **sem desconto**: valor = saldo devedor total (inclui juros contratados das parcelas futuras).
- **RN-C09** Contrato vai para QUITADO automaticamente quando o saldo devedor chega a zero.
- **RN-C10** Criação bloqueada se o principal exceder o saldo disponível da conta (ou exige confirmação explícita do ADMIN, registrada em auditoria).
- **RN-C11** Na criação, o sistema mostra ao ADMIN os contratos ativos e atrasados da pessoa (aviso, não bloqueio).
- **RN-C12** Parâmetros de encargo são **copiados para o contrato** na criação; alterar o padrão depois não afeta contratos existentes ([ADR-0008](../adr/0008-condicoes-congeladas-no-contrato.md)).

### Encargos de atraso (RN-E)
- **RN-E01** Parcela vencida e não paga após a carência gera: **multa** (% única sobre o valor em aberto da parcela) + **juros de mora** (% ao mês, *pro rata die*, sobre o valor em aberto).
- **RN-E02** Encargos são calculados na data de consulta/pagamento; não são lançados antecipadamente.
- **RN-E03** Valores padrão definidos em formulário (RF-40) e ajustáveis por contrato (RF-41).

### Recebimentos (RN-R)
- **RN-R01** Só pagamento CONFIRMADO produz efeitos (saldo, tesouraria).
- **RN-R02** Distribuição: parcela **mais antiga primeiro**; dentro da parcela: **encargos → juros → principal**.
- **RN-R03** Excedente segue para a próxima parcela; pagamento acima do saldo total é recusado.
- **RN-R04** Pagamento parcial permitido (parcela fica PARCIAL).
- **RN-R05** Pagamento antes do vencimento é normal, sem desconto.
- **RN-R06** Comprovante obrigatório para PIX, BOLETO e TRANSFERÊNCIA; opcional para ESPÉCIE.
- **RN-R07** Estorno não apaga: marca ESTORNADO e desfaz a distribuição ([ADR-0006](../adr/0006-registros-imutaveis-e-auditoria.md)).
- **RN-R08** Atraso **não é campo do pagamento**: é calculado por parcela.

### Tesouraria (RN-T)
- **RN-T01** Saldo da conta = soma das movimentações; nunca digitado.
- **RN-T02** Desembolso e recebimento geram movimentação automaticamente (via eventos).
- **RN-T03** Recebimento é separado em retorno de principal × juros × encargos.
- **RN-T04** MVP opera com **uma conta base**; o modelo já suporta várias.

### Acesso (RN-A)
- **RN-A01** Dois papéis: ADMIN e CLIENTE ([ADR-0007](../adr/0007-controle-de-acesso-por-papeis.md)).
- **RN-A02** CLIENTE só lê; só acessa dados da Pessoa vinculada ao seu usuário.
- **RN-A03** Toda ação de ADMIN que altera dados é auditada.
- **RN-A04** CLIENTE acessa o portal **somente com o CPF**, sem senha nem outro fator. O acesso é de **leitura** e só funciona para pessoas com acesso habilitado (RF-60). Proteções invisíveis ao cliente: limite de consultas por IP, mensagem genérica quando o CPF não existe, registro de cada acesso. *(Risco conhecido: ver legal L-08.)*
- **RN-A05** ADMIN acessa com **login e senha**, sem 2º fator no MVP.

## 7. Requisitos não funcionais

- **RNF-01** Cálculos financeiros determinísticos e cobertos por testes com os exemplos da seção 8.
- **RNF-02** Nenhum dado pessoal real no repositório (é público); dados de teste fictícios.
- **RNF-03** Dados pessoais protegidos conforme LGPD ([legal](../legal/pontos-legais.md)).
- **RNF-04** Todo módulo testável isoladamente; integração entre módulos só via contratos públicos/eventos ([RFC-001](../rfc/RFC-001-dominios-e-integracao.md)).
- **RNF-05** Portal do cliente utilizável no celular.
- **RNF-06** Datas no fuso America/Sao_Paulo; valores exibidos em R$ com duas casas.

## 8. Critérios de aceite (exemplos obrigatórios em teste)

| # | Cenário | Esperado |
|---|---|---|
| CA-01 | Principal 5.000,00; 6,33% a.m.; 6 parcelas | juros 1.899,00 → 1.900; parcela 1.150,00; total 6.900,00 (igual à planilha) |
| CA-02 | Principal 2.000,00; 6,25%; 4 parcelas | total 2.500,00; 4 × 625,00 |
| CA-03 | Principal 27.965,50; 7,45%; 10 parcelas | juros 20.834,30 → 20.835; 48.800,50 ÷ 10 = 4.880,05 → parcela 4.880,00; total 48.800,00 |
| CA-04 | Parcela única 5.000,00 a 10%, cliente paga 500,00 e renova | contrato 1 RENOVADO; contrato 2 ATIVO de 5.000,00 vinculado ao 1 |
| CA-05 | Parcela de 1.000,00 em aberto, multa 2%, mora 1% a.m., 15 dias de atraso, carência 0 | multa 20,00 + mora 5,00 = 1.025,00 |
| CA-06 | Pagamento de 1.025,00 na parcela do CA-05 | encargos 25,00 → juros → principal; parcela PAGA |
| CA-07 | Estorno do pagamento do CA-06 | parcela volta a VENCIDA; tesouraria recebe lançamento compensatório |
| CA-08 | 1º vencimento 31/01/2027, a cada 1 mês, 3 parcelas | 31/01/2027, 28/02/2027, 31/03/2027 |
| CA-08b | 1º vencimento 05/01/2027, a cada 7 dias, 4 parcelas | 05/01, 12/01, 19/01, 26/01/2027 |
| CA-08c | 1º vencimento 15/01/2027, a cada 2 meses, 3 parcelas | 15/01, 15/03, 15/05/2027 |
| CA-09 | Consulta pelo CPF do cliente A tenta abrir contrato do cliente B (id na URL) | acesso negado |
| CA-09b | 30 consultas de CPFs diferentes em 1 minuto do mesmo IP | bloqueio temporário do IP |
| CA-11 | 1.000,00 a 10% a.m., semanal, 4 parcelas | fator 7/30; juros 93,33 → 95; 1.095 ÷ 4 = 273,75 → parcela 275,00; total 1.100,00 |
| CA-12 | Arredondamento: 91,00 · 92,50 · 93,33 · 97,49 | 90 · 95 · 95 · 95 |
| CA-10 | Alterar multa padrão depois de criar contrato | contrato existente mantém a multa original |

## 9. Métricas de sucesso

- 100% dos contratos da planilha importados (consistentes ou na lista "a revisar").
- Zero campo financeiro digitado que pudesse ser calculado.
- ADMIN responde "quanto tenho emprestado e quanto está atrasado" em uma tela.
- Cliente consulta a própria situação sem precisar perguntar.

## 10. Decisões de produto registradas

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-14 | Encargos de atraso? | Sim, multa + mora, ajustáveis em formulário |
| 2026-11-14 | Desconto em quitação antecipada? | Não no MVP |
| 2026-11-14 | Limite de renovações? | Não no MVP |
| 2026-11-14 | "10 e 30"? | São 2 parcelas no mesmo mês; MVP só 1 parcela/mês |
| 2026-11-14 | Perfis de acesso? | ADMIN e CLIENTE (portal de consulta) |
| 2026-11-14 | Score? | Fora do MVP; módulo/feature à parte |
| 2026-11-14 | Login do cliente? | Só CPF, página somente leitura, sem fricção (por ora) |
| 2026-11-14 | Login do ADMIN? | Login e senha, sem 2º fator no MVP |
| 2026-11-14 | Data de vencimento? | 1º vencimento e periodicidade (dias ou meses) negociados no contrato |
| 2026-11-14 | Taxa com periodicidade não mensal (PEND-05)? | Taxa sempre **ao mês**, proporcional ao intervalo |
| 2026-11-14 | Idioma? | Código e termos técnicos em inglês; documentação em pt-BR ([ADR-0012](../adr/0012-idioma-codigo-ingles-docs-portugues.md)) |
| 2026-11-14 | Arredondamento? | Múltiplo de R$ 5, para o mais próximo: juros e depois parcela (RN-C03) |
| 2026-11-14 | Backend? | Node + TypeScript, desde que suporte o futuro módulo de WhatsApp (ver RFC-003 §5) |
| 2026-11-19 | Tela de atualização de pagamento por contrato? | Fica para a v1.1; no MVP, E7-F04 como planejada ([decisoes-2026-11-19](../plano/decisoes-2026-11-19.md)) |

## 11. Pendências

- **PEND-01** Quantidade de contas base: assumido **uma** no MVP (RN-T04). Confirmar.
- ~~PEND-02~~ Login do cliente → resolvido: só CPF (RN-A04).
- ~~PEND-03~~ Stack → Node + TypeScript ([RFC-003](../rfc/RFC-003-stack-tecnologica.md)); ADRs aguardam análise do Joel.
- ~~PEND-05~~ Taxa com periodicidade não mensal → resolvido: taxa ao mês, proporcional (RN-C02).
- **PEND-06** UX da escolha de datas (calendário).
- **PEND-04** Carência padrão de encargos (dias) → valor inicial no formulário.

## 12. Fluxos de exceção (aprovado em 2026-11-14)

### Renovação (detalha RN-C07)
- **RN-C13** Os juros do período são pagos com um **pagamento normal** (RF-20), distribuído na parcela como sempre (encargos → juros → principal). A parcela fica PARCIAL, com o principal em aberto.
- **RN-C14** "Renovar" só é permitido quando **juros e encargos vencidos estão pagos**. Juros pagos em parte → renovação bloqueada; o caminho é a renegociação (RN-C17).
- **RN-C15** O novo contrato nasce com principal = **principal em aberto** do anterior, mesmas condições (podem ser ajustadas antes de ativar), 1º vencimento negociado, `contrato_origem_id` preenchido. O anterior vai para RENOVADO.
- **RN-C16** Renovação **não movimenta dinheiro** (nada sai nem entra da conta): não gera desembolso nem recebimento.

### Renegociação
- **RN-C17** Novo principal = **saldo devedor na data** (principal em aberto + juros vencidos não pagos + encargos). A parte que não era principal fica registrada no novo contrato como `valor_capitalizado`, para a tesouraria separar juros de retorno de principal quando for paga.
- **RN-C18** Também não movimenta dinheiro. O anterior vai para RENEGOCIADO.

### Baixa como perda
- **RN-C19** Contrato vai para BAIXADO_PERDA com justificativa obrigatória. O saldo deixa de ser cobrado e de contar como capital emprestado; o valor baixado aparece no indicador **perdas** da tesouraria. Não há movimentação de dinheiro.
- **RN-C20** Pagamento recebido depois da baixa é permitido (**recuperação**): entra na conta como recebimento e no indicador "recuperado"; o contrato continua BAIXADO_PERDA.

### Pagamento em contrato encerrado
- **RN-R09** Contratos QUITADO, RENOVADO, RENEGOCIADO e CANCELADO **não aceitam pagamento**. A mensagem indica o contrato sucessor, quando houver. Exceção: BAIXADO_PERDA (RN-C20).

### Estorno depois de mudança de status
- **RN-R10** Estorno que faz um contrato QUITADO voltar a ter saldo → contrato volta para ATIVO (evento `ContratoReaberto`).
- **RN-R11** Estorno de pagamento de contrato RENOVADO ou RENEGOCIADO é **bloqueado** (o contrato seguinte já depende dele). Correção = ajuste manual justificado no contrato sucessor.

### Operação
- **RNF-07** Backup diário do banco, com retenção mínima de 30 dias, e teste de restauração antes de usar com dados reais.

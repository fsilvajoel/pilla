# Pontos legais e regulatórios

> Anotações para estudo e consulta futura a contador/advogado. **Não bloqueiam o MVP**, que é um produto de estudo de arquitetura. Não constituem parecer jurídico.

| # | Tema | Ponto | Impacto possível no produto |
|---|---|---|---|
| L-01 | **Lei de Usura** (Decreto 22.626/1933) e Código Civil art. 591 | Empréstimo entre pessoas físicas / não instituições financeiras tem limite de juros (em regra 12% a.a. ou taxa legal). Taxas de 6–10% a.m. podem ser contestadas. | Limite máximo de taxa configurável; aviso ao exceder. |
| L-02 | **Empresa Simples de Crédito – ESC** (LC 167/2019) | Formato legal para emprestar com capital próprio, sem limite de juros da Lei de Usura, com regras (atuação municipal, só capital próprio, registro das operações). | Se adotado: exigir CNPJ na conta base, relatórios de operações. |
| L-03 | **LGPD** (Lei 13.709/2018) | CPF, endereço, telefone e comprovantes são dados pessoais. Exige base legal, finalidade, segurança, direito de acesso/correção/eliminação. | Controle de acesso (ADR-0007), auditoria, exportação/anonimização de dados, nada de dado real no repositório. |
| L-04 | **Contrato escrito** | Contrato assinado (e nota promissória, se usada) dá segurança jurídica para cobrança. | Anexo "contrato assinado" no Contrato; futuro: geração do documento. |
| L-05 | **Encargos de atraso** | Multa moratória costuma ser limitada a 2% em relações de consumo (CDC art. 52 §1º); mora usualmente 1% a.m. | Formulário de parâmetros com limites/avisos. |
| L-06 | **Cobrança** (CDC art. 42) | Cobrança não pode expor ou constranger o devedor. | Futuro módulo de Cobrança: mensagens privadas e registradas. |
| L-07 | **Imposto de renda / IOF** | Juros recebidos são renda tributável; empréstimos podem ter IOF dependendo do formato. | Relatório anual de juros recebidos por pessoa. |
| L-08 | **Acesso ao portal só por CPF** (ADR-0011) | CPF não é segredo: quem souber o CPF de um cliente vê os contratos dele. Sob a LGPD, isso pode ser visto como medida de segurança insuficiente (art. 46) se houver vazamento. | Aceito no MVP com mitigações (dados mínimos, limite por IP, registro de acessos). Antes de escalar: 2º fator leve (data de nascimento ou código por WhatsApp). |
| L-09 | **WhatsApp** (módulo futuro) | Uso da API oficial (WhatsApp Business Platform) segue as políticas da Meta: consentimento para mensagens ativas, modelos aprovados. Bibliotecas não oficiais violam os termos e podem ter o número banido. | Usar só a API oficial; registrar consentimento do cliente. |

# ADR-0011 — Acesso do cliente só por CPF (leitura) e do ADMIN por login e senha

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) RN-A04/A05, [RFC-003](../rfc/RFC-003-stack-tecnologica.md) §4.5 |

## Contexto
O cliente só precisa **ver** a situação dos próprios contratos, e Joel decidiu que não haverá fricção além do CPF no MVP. O ADMIN precisa de acesso simples e completo. CPF não é segredo, então quem souber o CPF de alguém vê os contratos dessa pessoa: o risco é aceito no MVP e reduzido pelas medidas abaixo.

## Decisão
**CLIENTE (portal)**
- Acesso informando **só o CPF**, sem senha. Página **somente leitura**.
- Só funciona para pessoas com acesso habilitado pelo ADMIN.
- Exibe apenas dados do contrato (valores, datas, parcelas, pagamentos). **Não exibe** endereço, telefone, e-mail, chaves PIX, comprovantes nem CPF completo.
- Proteções invisíveis: limite de consultas por IP, resposta genérica para CPF inexistente/sem acesso, registro de cada acesso (`RegistroAcesso`), sessão curta.
- Toda consulta é filtrada no servidor pela Pessoa do CPF; ids vindos do navegador nunca são confiados (ADR-0007).
- O acesso fica isolado num único ponto do módulo `acesso`: adicionar um fator depois (data de nascimento, código por WhatsApp) não muda o portal nem os módulos de negócio.

**ADMIN**
- Login e senha (hash argon2id), sessão no servidor com cookie `httpOnly`, `Secure`, `SameSite=Lax`. Sem 2º fator no MVP.

## Consequências
- Zero fricção para o cliente.
- Exposição de dados financeiros a quem tiver o CPF (ver [legal L-08](../legal/pontos-legais.md)). Reavaliar antes de uso com clientes reais em escala.

## Alternativas consideradas
- **CPF + senha**: mais seguro, rejeitado por fricção (decisão do Joel).
- **CPF + data de nascimento / código por WhatsApp**: candidatos para a próxima versão.
- **JWT sem estado para ADMIN**: difícil revogar.

// Fonte única dos textos do portal do cliente (E15 D12, RF-64): frases curtas, sem sigla (só CPF), sem texto solto nos
// componentes. Os valores seguem a tabela de docs/plano/E15-F05A/plano.md.

export const portalTexts = {
  appName: "Meus empréstimos",
  entry: {
    title: "Acompanhe seus empréstimos",
    instruction: "Digite o seu CPF para ver a situação dos seus contratos.",
    fieldLabel: "CPF",
    fieldHelp: "Só números, 11 dígitos.",
    submit: "Ver meus contratos",
    submitting: "Entrando...",
    invalidCpf: "Esse CPF não parece certo. Confira os 11 números.",
    unauthorized:
      "Não foi possível entrar com este CPF. Se você acha que deveria ter acesso, fale com quem fez o seu empréstimo.",
    tooManyAttempts: "Muitas tentativas. Espere um minuto e tente de novo.",
    unexpected: "Algo deu errado. Tente de novo em instantes.",
    tryAgain: "Tentar de novo",
    sessionExpired: "Por segurança, entre de novo com o seu CPF.",
  },
  list: {
    title: "Seus contratos",
    empty: "Não encontramos contratos para este CPF.",
    details: "Ver detalhes",
    contract: (loanNumber: string): string => `Contrato ${loanNumber}`,
    borrowed: (amount: string): string => `Emprestado: ${amount}`,
    outstanding: (amount: string): string => `Falta pagar: ${amount}`,
    nextDue: (date: string): string => `Próxima parcela em ${date}`,
    paidOff: "Contrato quitado. Nada a pagar.",
  },
  situation: {
    CURRENT: "Em dia",
    OVERDUE: "Em atraso",
    PAID_OFF: "Quitado",
  },
  signOut: "Sair",
  detail: {
    back: "Voltar para os meus contratos",
    summary: {
      principal: "Valor emprestado",
      total: "Total a pagar",
      paid: "Já pago",
      outstanding: "Falta pagar",
    },
    nextInstallment: (amount: string, date: string): string => `Próxima parcela: ${amount} em ${date}.`,
    paidOff: "Contrato quitado. Nada a pagar.",
    lateCharges: (amount: string): string => `Você tem parcelas em atraso. Os encargos de atraso somam ${amount}.`,
    installments: {
      title: "Parcelas",
      number: "Parcela",
      dueDate: "Vence em",
      amount: "Valor",
      paid: "Já pago",
      status: "Situação",
    },
    installmentStatus: {
      PAID: "Paga",
      OPEN: "Em aberto",
      PARTIAL: "Paga em parte",
      OVERDUE: "Atrasada",
      OVERDUE_PARTIAL: "Atrasada, paga em parte",
    },
    payments: {
      title: "Pagamentos que recebemos",
      date: "Data",
      amount: "Valor",
      method: "Forma",
      empty: "Ainda não recebemos pagamentos deste contrato.",
    },
    method: {
      PIX: "Pix",
      BOLETO: "Boleto",
      CASH: "Dinheiro",
      BANK_TRANSFER: "Transferência",
    },
    notFound: "Não encontramos este contrato.",
  },
} as const;

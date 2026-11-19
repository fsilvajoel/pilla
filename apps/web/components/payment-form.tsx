"use client";

import type { LoanDetailResponse, PaymentFields } from "@pilla/schemas";
import type { JSX } from "react";
import type { PaymentFormValues } from "@/lib/payment-draft";
import { cents, formatReais } from "@pilla/finance";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { paymentMethodLabel } from "@/lib/labels";
import { toPaymentDraft } from "@/lib/payment-draft";

export interface PaymentFormProps {
  /** contrato do pagamento (dados de mentira) */
  readonly loan: LoanDetailResponse;
  /** recebe o pagamento pronto; sem API ainda */
  readonly onSubmit?: (payment: PaymentFields) => void;
}

type Outcome = "idle" | "ok" | "error";

type ClosedStatus = Extract<LoanDetailResponse["status"], "PAID_OFF" | "RENEWED" | "RENEGOTIATED" | "CANCELLED">;

const closedStatusNotice: Record<ClosedStatus, string> = {
  PAID_OFF: "Este contrato já foi quitado e não aceita novos pagamentos.",
  CANCELLED: "Este contrato foi cancelado e não aceita pagamentos.",
  RENEWED: "Este contrato foi renovado. Registre o pagamento no contrato novo.",
  RENEGOTIATED: "Este contrato foi renegociado. Registre o pagamento no contrato novo.",
};

function isClosedStatus(status: LoanDetailResponse["status"]): status is ClosedStatus {
  return status in closedStatusNotice;
}

const methods: readonly PaymentFormValues["method"][] = ["PIX", "BOLETO", "CASH", "BANK_TRANSFER"];

/**
 * Registrar pagamento do ADMIN (PRD-001 RF-20). Título (h1) "Registrar pagamento", "Contrato " + `loanNumber` e
 * "Saldo devedor R$ " + `formatReais(outstandingCents)`. Contrato fechado (PAID_OFF, RENEWED, RENEGOTIATED,
 * CANCELLED) bloqueia a tela com o título "Contrato encerrado" e o aviso do status (`closedStatusNotice`); DRAFT aceita. Formulário React Hook Form
 * com `PaymentFormValues` de `@/lib/payment-draft`: "Chave Pix de destino" (input de texto), "Data do pagamento"
 * (input type="date"), "Valor" e "Método" (select com PIX, BOLETO, CASH, BANK_TRANSFER e o texto de
 * `paymentMethodLabel` de `@/lib/labels`; começa em PIX). Sem comprovante. O botão "Registrar pagamento" chama
 * `toPaymentDraft(loan.id, campos)`, depois `onSubmit` e mostra "Pagamento registrado para conferência." num
 * elemento role="status". Erro: "Confira os campos do pagamento." num elemento role="alert", sem chamar `onSubmit`.
 */
export function PaymentForm({ loan, onSubmit }: PaymentFormProps): JSX.Element {
  const { register, handleSubmit } = useForm<PaymentFormValues>({
    defaultValues: { destinationKey: "", paidAt: "", amount: "", method: "PIX" },
  });
  const [outcome, setOutcome] = useState<Outcome>("idle");

  const header = (
    <>
      <h1>Registrar pagamento</h1>
      <p>Contrato {loan.loanNumber}</p>
      <p>Saldo devedor R$ {formatReais(cents(BigInt(loan.outstandingCents)))}</p>
    </>
  );

  if (isClosedStatus(loan.status)) {
    return (
      <div>
        {header}
        <div role="alert">
          <h2>Contrato encerrado</h2>
          <p>{closedStatusNotice[loan.status]}</p>
        </div>
      </div>
    );
  }

  const submit = (values: PaymentFormValues): void => {
    try {
      const payment = toPaymentDraft(loan.id, values);
      onSubmit?.(payment);
      setOutcome("ok");
    } catch {
      setOutcome("error");
    }
  };

  return (
    <div>
      {header}
      <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <label>
          Chave Pix de destino
          <input type="text" {...register("destinationKey")} />
        </label>
        <label>
          Data do pagamento
          <input type="date" {...register("paidAt")} />
        </label>
        <label>
          Valor
          <input type="text" {...register("amount")} />
        </label>
        <label>
          Método
          <select {...register("method")}>
            {methods.map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabel[method]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Registrar pagamento</button>
      </form>
      {outcome === "ok" ? <p role="status">Pagamento registrado para conferência.</p> : null}
      {outcome === "error" ? <p role="alert">Confira os campos do pagamento.</p> : null}
    </div>
  );
}

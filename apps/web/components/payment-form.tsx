"use client";

import type { AccountSummary, LoanDetailResponse, PaymentFields } from "@pilla/schemas";
import type { JSX } from "react";
import type { PaymentActionResult, PreviewActionResult } from "@/components/payments/payment-actions";
import type { PaymentFormValues } from "@/lib/payment-draft";
import { cents, formatReais, parseReais } from "@pilla/finance";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AllocationPreviewView } from "@/components/payments/allocation-preview-view";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentMethodLabel } from "@/lib/labels";
import { toPaymentDraft } from "@/lib/payment-draft";

export interface PaymentFormProps {
  readonly loan: LoanDetailResponse;
  /** contas de destino (`GET /accounts`); a primeira ativa vem escolhida (conta base do MVP) */
  readonly accounts: readonly AccountSummary[];
  /** hoje em Brasília, data padrão */
  readonly today?: string;
  /** contrato sucessor de um contrato renovado ou renegociado */
  readonly successorLoanId?: string;
  /** prévia da alocação (server action) */
  readonly onPreview?: (input: unknown) => Promise<PreviewActionResult>;
  /** registra o pagamento (server action); a mesma chave repete o mesmo registro */
  readonly onSubmit?: (
    payment: PaymentFields,
    idempotencyKey: string,
  ) => Promise<PaymentActionResult<unknown> | undefined>;
}

type Outcome = "idle" | "ok" | "error";
type PreviewState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly result: Extract<PreviewActionResult, { ok: true }>["data"] }
  | { readonly kind: "error"; readonly message: string };

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
const selectClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";
const PREVIEW_DELAY_MS = 400;

/**
 * Registrar pagamento do ADMIN (PRD-001 RF-20, RF-23). Título (h1) "Registrar pagamento", "Contrato " +
 * `loanNumber` e "Saldo devedor R$ ". Contrato fechado bloqueia a tela com "Contrato encerrado" e o aviso do status
 * (com o link do sucessor, quando houver). Campos: "Conta de destino" (select), "Data do pagamento", "Valor" e
 * "Método"; sem comprovante. A prévia da alocação se atualiza ao mudar valor ou data. O envio chama `onSubmit`
 * com uma `Idempotency-Key` e mostra "Pagamento registrado para conferência." (role="status"); erro vira role="alert".
 */
export function PaymentForm({
  loan,
  accounts,
  today = "",
  successorLoanId,
  onPreview,
  onSubmit,
}: PaymentFormProps): JSX.Element {
  const activeAccounts = accounts.filter((account) => account.active);
  const { register, handleSubmit, control, reset } = useForm<PaymentFormValues>({
    defaultValues: { accountId: activeAccounts[0]?.id ?? "", paidAt: today, amount: "", method: "PIX" },
  });
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [message, setMessage] = useState("Confira os campos do pagamento.");
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{ readonly key: string; readonly result: PreviewActionResult } | null>(null);
  const attempt = useRef<{ readonly body: string; readonly key: string } | null>(null);

  const amount = useWatch({ control, name: "amount" });
  const paidAt = useWatch({ control, name: "paidAt" });
  const closed = isClosedStatus(loan.status);

  const previewInput = useMemo(() => {
    try {
      const amountCents = Number(parseReais(amount));
      return amountCents > 0 && paidAt !== "" ? { loanId: loan.id, amountCents, paidAt } : null;
    } catch {
      return null;
    }
  }, [loan.id, amount, paidAt]);
  const previewKey = previewInput === null ? "" : `${String(previewInput.amountCents)}|${previewInput.paidAt}`;

  useEffect(() => {
    if (closed || onPreview === undefined || previewInput === null) return;
    let current = true;
    const timer = setTimeout(() => {
      void onPreview(previewInput).then((result) => {
        if (current) setPreview({ key: previewKey, result });
      });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [previewInput, previewKey, closed, onPreview]);

  const previewState: PreviewState =
    onPreview === undefined || previewInput === null
      ? { kind: "idle" }
      : preview?.key !== previewKey
        ? { kind: "loading" }
        : preview.result.ok
          ? { kind: "ok", result: preview.result.data }
          : { kind: "error", message: preview.result.message };

  const header = (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Registrar pagamento</h1>
      <p>Contrato {loan.loanNumber}</p>
      <p>Saldo devedor R$ {formatReais(cents(BigInt(loan.outstandingCents)))}</p>
    </>
  );

  if (isClosedStatus(loan.status)) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <div role="alert" className="rounded-lg border border-destructive/40 p-4">
          <h2 className="font-semibold">Contrato encerrado</h2>
          <p>{closedStatusNotice[loan.status]}</p>
          {successorLoanId !== undefined && (
            <Link href={`/emprestimos/${successorLoanId}`} className="text-sm underline">
              Abrir o contrato novo
            </Link>
          )}
        </div>
      </div>
    );
  }

  const fail = (text: string, errors: Readonly<Record<string, string>> = {}): void => {
    setMessage(text);
    setFieldErrors(errors);
    setOutcome("error");
  };

  const submit = async (values: PaymentFormValues): Promise<void> => {
    let payment: PaymentFields;
    try {
      payment = toPaymentDraft(loan.id, values);
    } catch {
      fail("Confira os campos do pagamento.");
      return;
    }
    const body = JSON.stringify(payment);
    // mesmo corpo repete a chave (reenvio seguro); corpo novo ganha chave nova
    attempt.current = attempt.current?.body === body ? attempt.current : { body, key: globalThis.crypto.randomUUID() };
    setPending(true);
    try {
      const result = await onSubmit?.(payment, attempt.current.key);
      if (result !== undefined && !result.ok) {
        fail(result.message, result.fieldErrors);
        return;
      }
      setFieldErrors({});
      setOutcome("ok");
      attempt.current = null;
      reset({ ...values, amount: "" });
    } catch {
      fail("Não foi possível registrar agora. Tente de novo.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">{header}</div>
      <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate className="flex max-w-xl flex-col gap-4">
        <FormField
          id="accountId"
          label="Conta de destino"
          {...(fieldErrors.accountId ? { error: fieldErrors.accountId } : {})}
        >
          <select className={selectClass} {...register("accountId")}>
            <option value="">Selecione</option>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="paidAt" label="Data do pagamento" {...(fieldErrors.paidAt ? { error: fieldErrors.paidAt } : {})}>
          <Input type="date" {...register("paidAt")} />
        </FormField>
        <FormField
          id="amount"
          label="Valor"
          description="Em reais, ex.: 1.150,00"
          {...(fieldErrors.amountCents ? { error: fieldErrors.amountCents } : {})}
        >
          <Input type="text" inputMode="decimal" {...register("amount")} />
        </FormField>
        <FormField id="method" label="Método" {...(fieldErrors.method ? { error: fieldErrors.method } : {})}>
          <select className={selectClass} {...register("method")}>
            {methods.map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabel[method]}
              </option>
            ))}
          </select>
        </FormField>
        <div>
          <Button type="submit" disabled={pending}>
            Registrar pagamento
          </Button>
        </div>
      </form>
      {outcome === "ok" ? (
        <p role="status">
          Pagamento registrado para conferência.{" "}
          <Link href={`/pagamentos?loanId=${loan.id}`} className="underline">
            Ver pagamentos do contrato
          </Link>
        </p>
      ) : null}
      {outcome === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      {previewState.kind === "loading" && (
        <p role="status" aria-label="Calculando a prévia" className="text-sm text-muted-foreground">
          Calculando a prévia…
        </p>
      )}
      {previewState.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {previewState.message}
        </p>
      )}
      {previewState.kind === "ok" && <AllocationPreviewView preview={previewState.result} />}
    </div>
  );
}

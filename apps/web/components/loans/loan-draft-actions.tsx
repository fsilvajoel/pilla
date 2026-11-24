"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AccountSummary } from "@pilla/schemas";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/components/treasury/treasury-format";
import type { LoanActionResult } from "./loan-actions";

export type LoanDraftActionsProps = {
  readonly loanId: string;
  readonly version: number;
  /** valor do contrato, para o aviso de caixa (RN-C10) */
  readonly principalCents: number;
  /** hoje em Brasília (E10 D11), padrão da data de desembolso */
  readonly today: string;
  readonly accounts: readonly AccountSummary[];
  readonly onActivate: (id: string, version: number, input: unknown) => Promise<LoanActionResult>;
  readonly onCancel: (id: string, version: number) => Promise<LoanActionResult>;
};

const selectClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** Ativar (data e conta) e Cancelar (só confirmação) de um contrato em DRAFT (E10 D12). */
export function LoanDraftActions(props: LoanDraftActionsProps): ReactElement {
  const { loanId, version, principalCents, today, accounts, onActivate, onCancel } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [disbursedAt, setDisbursedAt] = useState(today);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const chosen = accounts.find((account) => account.id === accountId);
  const cashShort = chosen !== undefined && principalCents > chosen.balanceCents;

  function finish(result: LoanActionResult, success: string): void {
    if (result.ok) {
      toast.success(success);
      router.refresh();
      return;
    }
    setFieldErrors(result.fieldErrors);
    setError(result.message);
  }

  function activate(): void {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      finish(await onActivate(loanId, version, { disbursedAt, accountId }), "Contrato ativado.");
    });
  }

  function cancel(): void {
    setError(null);
    startTransition(async () => {
      finish(await onCancel(loanId, version), "Contrato cancelado.");
    });
  }

  return (
    <section className="flex max-w-xl flex-col gap-4" aria-label="Ações do rascunho">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          activate();
        }}
      >
        <FormField
          id="disbursedAt"
          label="Data do desembolso"
          {...(fieldErrors.disbursedAt ? { error: fieldErrors.disbursedAt } : {})}
        >
          <Input
            type="date"
            value={disbursedAt}
            onChange={(event) => {
              setDisbursedAt(event.target.value);
            }}
          />
        </FormField>
        <FormField
          id="accountId"
          label="Conta de desembolso"
          {...(fieldErrors.accountId ? { error: fieldErrors.accountId } : {})}
        >
          <select
            className={selectClass}
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
            }}
          >
            <option value="">Selecione</option>
            {accounts
              .filter((account) => account.active)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </FormField>
        {cashShort && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
            O caixa registrado ({formatMoney(chosen.balanceCents)}) é menor que o valor do contrato (
            {formatMoney(principalCents)}). Você pode ativar mesmo assim.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Ativar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancelar contrato?"
        description="O rascunho será cancelado e não poderá ser ativado depois."
        confirmLabel="Cancelar contrato"
        cancelLabel="Voltar"
        destructive
        onConfirm={cancel}
      />
    </section>
  );
}

"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cents, formatReais } from "@pilla/finance";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LoanActionResult } from "./loan-actions";
import { rolloverPreview, type RolloverKind } from "./rollover-preview";

export type RolloverFormProps = {
  readonly kind: RolloverKind;
  readonly loanId: string;
  readonly installmentCount: number;
  /** cotação de hoje, base do que o novo contrato vai levar */
  readonly quote: {
    readonly amountCents: number;
    readonly principalCents: number;
    readonly interestCents: number;
    readonly lateChargesCents: number;
    readonly date: string;
  };
  readonly onSubmit: (id: string, input: unknown) => Promise<LoanActionResult>;
};

const money = (value: number): string => `R$ ${formatReais(cents(BigInt(value)))}`;

/** Renovar ou renegociar: mostra o novo principal (e a parte capitalizada) antes de confirmar e abre o novo DRAFT. */
export function RolloverForm(props: RolloverFormProps): ReactElement {
  const { kind, loanId, installmentCount, quote, onSubmit } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [firstDueDate, setFirstDueDate] = useState("");
  const [count, setCount] = useState(String(installmentCount));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const preview = rolloverPreview(kind, quote);
  const renewal = kind === "RENEWAL";

  function submit(): void {
    setError(null);
    setFieldErrors({});
    const parsedCount = Number(count);
    startTransition(async () => {
      const result = await onSubmit(loanId, {
        firstDueDate,
        ...(Number.isInteger(parsedCount) && parsedCount > 0 ? { installmentCount: parsedCount } : {}),
      });
      if (result.ok) {
        toast.success(renewal ? "Renovação criada em rascunho." : "Renegociação criada em rascunho.");
        router.push(`/emprestimos/${result.id}`);
        return;
      }
      setFieldErrors(result.fieldErrors);
      setError(result.message);
    });
  }

  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <dl className="grid grid-cols-2 gap-4" aria-label="Novo contrato">
        <div>
          <dt className="text-sm text-muted-foreground">Novo principal</dt>
          <dd className="font-medium">{money(preview.newPrincipalCents)}</dd>
        </div>
        {!renewal && (
          <div>
            <dt className="text-sm text-muted-foreground">Parte capitalizada</dt>
            <dd className="font-medium">{money(preview.capitalizedCents)}</dd>
          </div>
        )}
      </dl>
      <FormField
        id="firstDueDate"
        label="1º vencimento"
        {...(fieldErrors.firstDueDate ? { error: fieldErrors.firstDueDate } : {})}
      >
        <Input
          type="date"
          value={firstDueDate}
          onChange={(event) => {
            setFirstDueDate(event.target.value);
          }}
        />
      </FormField>
      <FormField
        id="installmentCount"
        label="Nº de parcelas"
        {...(fieldErrors.installmentCount ? { error: fieldErrors.installmentCount } : {})}
      >
        <Input
          type="text"
          inputMode="numeric"
          value={count}
          onChange={(event) => {
            setCount(event.target.value);
          }}
        />
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {renewal ? "Renovar" : "Renegociar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.back();
          }}
        >
          Voltar
        </Button>
      </div>
    </form>
  );
}

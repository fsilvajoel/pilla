"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { LoanActionResult } from "./loan-actions";

export type WriteOffFormProps = {
  readonly loanId: string;
  readonly version: number;
  readonly onWriteOff: (id: string, version: number, input: unknown) => Promise<LoanActionResult>;
};

/** Baixa como perda (RF-16): motivo obrigatório; depois volta ao detalhe, já como baixado. */
export function WriteOffForm({ loanId, version, onWriteOff }: WriteOffFormProps): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});

  function submit(): void {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await onWriteOff(loanId, version, { reason });
      if (result.ok) {
        toast.success("Contrato baixado como perda.");
        router.push(`/emprestimos/${loanId}`);
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
      <FormField id="reason" label="Motivo" {...(fieldErrors.reason ? { error: fieldErrors.reason } : {})}>
        <Textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          Baixar como perda
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

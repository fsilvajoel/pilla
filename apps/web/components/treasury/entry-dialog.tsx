"use client";

import { parseReais } from "@pilla/finance";
import { useRef, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ledgerEntryTypeLabel } from "@/lib/labels";
import type { EntryActionResult } from "./entry-actions";

export type EntryDialogProps = {
  readonly accountId: string;
  /** hoje em Brasília: padrão e limite da data (sem lançamento futuro) */
  readonly today: string;
  readonly onSubmit: (accountId: string, input: unknown, idempotencyKey: string) => Promise<EntryActionResult>;
};

type EntryKind = "CAPITAL_IN" | "CAPITAL_OUT" | "ADJUSTMENT";
type Sign = "IN" | "OUT";

const KINDS: readonly EntryKind[] = ["CAPITAL_IN", "CAPITAL_OUT", "ADJUSTMENT"];
const selectClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** Valor em reais vira centavos inteiros positivos; texto fora do formato ou zero vira null. */
function toPositiveCents(text: string): number | null {
  try {
    const value = Number(parseReais(text));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** "Novo lançamento": aporte, retirada ou ajuste (RF-30); uma `Idempotency-Key` por abertura do diálogo. */
export function EntryDialog({ accountId, today, onSubmit }: EntryDialogProps): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EntryKind>("CAPITAL_IN");
  const [sign, setSign] = useState<Sign>("IN");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [justification, setJustification] = useState("");
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ readonly body: string; readonly key: string } | null>(null);
  const openingKey = useRef("");

  function reset(): void {
    setKind("CAPITAL_IN");
    setSign("IN");
    setAmount("");
    setEntryDate(today);
    setJustification("");
    setErrors({});
    setFormError(null);
    attempt.current = null;
  }

  function changeOpen(next: boolean): void {
    if (next) {
      reset();
      openingKey.current = globalThis.crypto.randomUUID();
    }
    setOpen(next);
  }

  async function submit(): Promise<void> {
    const found: Record<string, string> = {};
    const cents = toPositiveCents(amount);
    if (cents === null) found.amountCents = "Informe um valor maior que zero, como 1.500,00.";
    if (entryDate === "") found.entryDate = "Informe a data.";
    else if (entryDate > today) found.entryDate = "A data não pode ser no futuro.";
    const reason = justification.trim();
    if (kind === "ADJUSTMENT" && reason === "") found.justification = "Informe a justificativa do ajuste.";
    setErrors(found);
    setFormError(null);
    if (cents === null || Object.keys(found).length > 0) return;

    const signed = kind === "ADJUSTMENT" && sign === "OUT" ? -cents : cents;
    const input = {
      type: kind,
      amountCents: signed,
      entryDate,
      ...(reason === "" ? {} : { justification: reason }),
    };
    // mesma abertura e mesmos dados repetem a chave; dados novos pedem chave nova
    const body = JSON.stringify(input);
    const previous = attempt.current;
    const key =
      previous === null ? openingKey.current : previous.body === body ? previous.key : globalThis.crypto.randomUUID();
    attempt.current = { body, key };
    setBusy(true);
    try {
      const result = await onSubmit(accountId, input, key);
      if (result.ok) {
        toast.success("Lançamento gravado.");
        setOpen(false);
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors);
      setFormError(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          changeOpen(true);
        }}
      >
        Novo lançamento
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>Novo lançamento</DialogTitle>
              <DialogDescription>Aporte, retirada ou ajuste na conta do caixa.</DialogDescription>
            </DialogHeader>
            <FormField id="entry-type" label="Tipo">
              <select
                className={selectClass}
                value={kind}
                onChange={(event) => {
                  setKind(KINDS.find((k) => k === event.target.value) ?? "CAPITAL_IN");
                }}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ledgerEntryTypeLabel[k]}
                  </option>
                ))}
              </select>
            </FormField>
            {kind === "ADJUSTMENT" && (
              <FormField id="entry-sign" label="Sentido do ajuste">
                <select
                  className={selectClass}
                  value={sign}
                  onChange={(event) => {
                    setSign(event.target.value === "OUT" ? "OUT" : "IN");
                  }}
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Saída</option>
                </select>
              </FormField>
            )}
            <FormField
              id="entry-amount"
              label="Valor (R$)"
              {...(errors.amountCents ? { error: errors.amountCents } : {})}
            >
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                }}
              />
            </FormField>
            <FormField id="entry-date" label="Data" {...(errors.entryDate ? { error: errors.entryDate } : {})}>
              <Input
                type="date"
                max={today}
                value={entryDate}
                onChange={(event) => {
                  setEntryDate(event.target.value);
                }}
              />
            </FormField>
            <FormField
              id="entry-justification"
              label={kind === "ADJUSTMENT" ? "Justificativa" : "Justificativa (opcional)"}
              {...(errors.justification ? { error: errors.justification } : {})}
            >
              <Textarea
                maxLength={500}
                value={justification}
                onChange={(event) => {
                  setJustification(event.target.value);
                }}
              />
            </FormField>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  changeOpen(false);
                }}
              >
                Voltar
              </Button>
              <Button type="submit" disabled={busy}>
                Gravar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

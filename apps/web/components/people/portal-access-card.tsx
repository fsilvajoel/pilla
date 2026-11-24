"use client";

import { Switch } from "radix-ui";
import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { PortalAccessResponse } from "@/lib/api/portal-access";
import { formatPortalAccessDate } from "./format";

export type PortalAccessActionResult =
  | { readonly ok: true; readonly access: PortalAccessResponse }
  | { readonly ok: false; readonly code: string | null; readonly message: string };

export const portalAccessTexts = {
  title: "Acesso ao portal do cliente",
  help: "O cliente entra só com o CPF e só consegue ver os contratos dele.",
  enabledSince: (date: string): string => `Acesso liberado desde ${date}`,
  enabled: "Acesso liberado",
  disabled: "Acesso não liberado",
  switchLabel: "Acesso ao portal",
  noCpf: "Cadastre o CPF para liberar o acesso.",
  turnedOn: "Acesso liberado.",
  turnedOff: "Acesso desligado. O cliente sai do portal na hora.",
  loadFailed: "Não foi possível ver o estado do acesso agora. Recarregue a página.",
} as const;

interface PortalAccessCardProps {
  personId: string;
  hasCpf: boolean;
  /** Estado lido da API; nulo se a leitura falhou. */
  initial: PortalAccessResponse | null;
  onChange: (personId: string, enabled: boolean) => Promise<PortalAccessActionResult>;
}

export function PortalAccessCard({ personId, hasCpf, initial, onChange }: PortalAccessCardProps): ReactElement {
  const [access, setAccess] = useState<PortalAccessResponse | null>(initial);
  const [error, setError] = useState<string | null>(initial === null ? portalAccessTexts.loadFailed : null);
  const [pending, startTransition] = useTransition();

  const enabled = hasCpf && access?.enabled === true;
  const loadFailed = access === null;

  function toggle(next: boolean): void {
    setError(null);
    startTransition(async () => {
      const result = await onChange(personId, next);
      if (result.ok) {
        setAccess(result.access);
        toast.success(next ? portalAccessTexts.turnedOn : portalAccessTexts.turnedOff);
        return;
      }
      const message = result.code === "PERSON_WITHOUT_CPF" ? portalAccessTexts.noCpf : result.message;
      setError(message);
      toast.error(message);
    });
  }

  const stateText = enabled
    ? access.enabledAt === null
      ? portalAccessTexts.enabled
      : portalAccessTexts.enabledSince(formatPortalAccessDate(access.enabledAt))
    : portalAccessTexts.disabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{portalAccessTexts.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{loadFailed ? "—" : stateText}</p>
            <p className="text-sm text-muted-foreground">{portalAccessTexts.help}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="portal-access-switch" className="sr-only">
              {portalAccessTexts.switchLabel}
            </Label>
            <Switch.Root
              id="portal-access-switch"
              checked={enabled}
              disabled={!hasCpf || loadFailed || pending}
              onCheckedChange={toggle}
              className="inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5" />
            </Switch.Root>
          </div>
        </div>
        {!hasCpf && <p className="text-sm text-muted-foreground">{portalAccessTexts.noCpf}</p>}
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

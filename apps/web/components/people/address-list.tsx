import type { ReactElement } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AddressDialog } from "./address-dialog";
import type { Address, CreateAddressRequest, UpdateAddressRequest } from "@pilla/schemas";

interface AddressListProps {
  addresses: readonly Address[];
  onAddAddress: (data: CreateAddressRequest) => Promise<unknown>;
  onUpdateAddress: (id: string, data: UpdateAddressRequest) => Promise<unknown>;
  onDeleteAddress: (id: string) => Promise<unknown>;
  onSetPrimaryAddress: (id: string) => Promise<unknown>;
}

export interface ServerError {
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

function readFailure(result: unknown): ServerError | null {
  if (typeof result !== "object" || result === null) return null;
  if (!("ok" in result) || result.ok !== false) return null;
  const message = "message" in result && typeof result.message === "string" ? result.message : null;
  const fieldErrors: Record<string, string> = {};
  if ("fieldErrors" in result && typeof result.fieldErrors === "object" && result.fieldErrors !== null) {
    for (const [key, value] of Object.entries(result.fieldErrors)) {
      if (typeof value === "string") fieldErrors[key] = value;
    }
  }
  return { message: message ?? "Não foi possível concluir a operação.", fieldErrors };
}

type DialogState = { kind: "create" } | { kind: "edit"; address: Address } | null;

export function AddressList({
  addresses,
  onAddAddress,
  onUpdateAddress,
  onDeleteAddress,
  onSetPrimaryAddress,
}: AddressListProps): ReactElement {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [serverError, setServerError] = useState<ServerError | null>(null);

  /** Roda a ação; falha da API vira mensagem (no dialog aberto ou toast) e onDone só roda em sucesso. */
  const run = (action: () => Promise<unknown>, onDone?: () => void, inDialog = false): void => {
    startTransition(async () => {
      try {
        const failure = readFailure(await action());
        if (failure === null) {
          setServerError(null);
          onDone?.();
        } else if (inDialog) {
          setServerError(failure);
        } else {
          toast.error(failure.message);
          setDeletingId(null);
        }
      } catch {
        toast.error("Não foi possível concluir a operação.");
      }
    });
  };

  const handleSubmit = (data: CreateAddressRequest): void => {
    const current = dialog;
    if (current === null) return;
    run(
      () => (current.kind === "create" ? onAddAddress(data) : onUpdateAddress(current.address.id, data)),
      () => {
        setDialog(null);
      },
      true,
    );
  };

  const handleDelete = (): void => {
    const id = deletingId;
    if (id === null) return;
    run(
      () => onDeleteAddress(id),
      () => {
        setDeletingId(null);
      },
    );
  };

  const handleSetPrimary = (address: Address): void => {
    if (!address.isPrimary) run(() => onSetPrimaryAddress(address.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Endereços</h3>
        <Button
          onClick={() => {
            setServerError(null);
            setDialog({ kind: "create" });
          }}
        >
          Adicionar endereço
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum endereço cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">
                    {address.street}, {address.number}
                    {address.complement && ` - ${address.complement}`}
                  </span>
                  {address.isPrimary && <Badge variant="success">Principal</Badge>}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-4">
                  <span>{address.district}</span>
                  <span>
                    {address.city} - {address.state}
                  </span>
                  <span>CEP: {address.postalCode.replace(/^(\d{5})(\d{3})$/, "$1-$2")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!address.isPrimary && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      handleSetPrimary(address);
                    }}
                  >
                    Tornar principal
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setServerError(null);
                    setDialog({ kind: "edit", address });
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeletingId(address.id);
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <AddressDialog
          key={dialog.kind === "edit" ? dialog.address.id : "create"}
          {...(dialog.kind === "edit" ? { initialData: dialog.address } : {})}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSubmit={handleSubmit}
          isSubmitting={isPending}
          serverError={serverError}
        />
      )}
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        title="Excluir endereço"
        description="Tem certeza que deseja excluir este endereço? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}

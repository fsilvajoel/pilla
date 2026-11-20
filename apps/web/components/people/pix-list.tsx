import type { ReactElement } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PixDialog } from "./pix-dialog";
import type { CreatePixKeyRequest, PixKey, PixKeyType, UpdatePixKeyRequest } from "@pilla/schemas";

interface PixListProps {
  pixKeys: readonly PixKey[];
  onAddPixKey: (data: CreatePixKeyRequest) => Promise<unknown>;
  onUpdatePixKey: (id: string, data: UpdatePixKeyRequest) => Promise<unknown>;
  onDeletePixKey: (id: string) => Promise<unknown>;
  onSetPrimaryPixKey: (id: string) => Promise<unknown>;
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

type DialogState = { kind: "create" } | { kind: "edit"; pixKey: PixKey } | null;

export function PixList({
  pixKeys,
  onAddPixKey,
  onUpdatePixKey,
  onDeletePixKey,
  onSetPrimaryPixKey,
}: PixListProps): ReactElement {
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

  const handleSubmit = (data: CreatePixKeyRequest): void => {
    const current = dialog;
    if (current === null) return;
    run(
      () => (current.kind === "create" ? onAddPixKey(data) : onUpdatePixKey(current.pixKey.id, data)),
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
      () => onDeletePixKey(id),
      () => {
        setDeletingId(null);
      },
    );
  };

  const handleSetPrimary = (pixKey: PixKey): void => {
    if (!pixKey.isPrimary) run(() => onSetPrimaryPixKey(pixKey.id));
  };

  const formatPixKeyValue = (type: PixKeyType, value: string): string => {
    switch (type) {
      case "CPF":
        return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
      case "CNPJ":
        return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
      case "PHONE":
        return value.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
      default:
        return value;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Chaves PIX</h3>
        <Button
          onClick={() => {
            setServerError(null);
            setDialog({ kind: "create" });
          }}
        >
          Adicionar chave
        </Button>
      </div>

      {pixKeys.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma chave PIX cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {pixKeys.map((pixKey) => (
            <div
              key={pixKey.id}
              className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">
                    {pixKey.type}: {formatPixKeyValue(pixKey.type, pixKey.value)}
                  </span>
                  {pixKey.isPrimary && <Badge variant="success">Principal</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!pixKey.isPrimary && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      handleSetPrimary(pixKey);
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
                    setDialog({ kind: "edit", pixKey });
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeletingId(pixKey.id);
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
        <PixDialog
          key={dialog.kind === "edit" ? dialog.pixKey.id : "create"}
          {...(dialog.kind === "edit" ? { initialData: dialog.pixKey } : {})}
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
        title="Excluir chave PIX"
        description="Tem certeza que deseja excluir esta chave PIX? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}

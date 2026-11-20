"use client";

import type { ReactElement } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
};

export function ConfirmDialog(_props: ConfirmDialogProps): ReactElement {
  throw new Error("esboço: não implementado");
}

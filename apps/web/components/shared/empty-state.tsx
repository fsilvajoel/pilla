import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

export type EmptyStateProps = { text: string; icon?: LucideIcon; action?: ReactNode };

export function EmptyState(_props: EmptyStateProps): ReactElement {
  throw new Error("esboço: não implementado");
}

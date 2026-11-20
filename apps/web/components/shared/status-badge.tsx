import type { ReactElement } from "react";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export type StatusBadgeMap<K extends string> = Record<K, { label: string; variant: BadgeVariant }>;

export type StatusBadgeProps<K extends string> = { status: K; map: StatusBadgeMap<K> };

export function StatusBadge<K extends string>(_props: StatusBadgeProps<K>): ReactElement {
  throw new Error("esboço: não implementado");
}

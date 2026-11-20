import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export type StatusBadgeMap<K extends string> = Record<K, { label: string; variant: BadgeVariant }>;

export type StatusBadgeProps<K extends string> = { status: K; map: StatusBadgeMap<K> };

export function StatusBadge<K extends string>({ status, map }: StatusBadgeProps<K>): ReactElement {
  const { label, variant } = map[status];
  return (
    <Badge variant={variant} data-variant={variant}>
      {label}
    </Badge>
  );
}

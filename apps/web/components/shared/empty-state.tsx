import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export type EmptyStateProps = { text: string; icon?: LucideIcon; action?: ReactNode };

export function EmptyState({ text, icon: Icon, action }: EmptyStateProps): ReactElement {
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        {Icon && <Icon className="size-12 text-muted-foreground" aria-hidden="true" />}
        <p className="text-muted-foreground">{text}</p>
        {action && <div>{action}</div>}
      </CardContent>
    </Card>
  );
}

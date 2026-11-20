import type { ReactElement } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const rows: readonly number[] = [0, 1, 2, 3, 4];

export function PeopleSkeleton(): ReactElement {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Carregando pessoas">
      {rows.map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </div>
  );
}

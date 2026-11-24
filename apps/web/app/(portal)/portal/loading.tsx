import type { ReactElement } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading(): ReactElement {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

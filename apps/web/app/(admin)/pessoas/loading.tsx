import type { ReactElement } from "react";
import { PeopleSkeleton } from "@/components/people/people-skeleton";
import { PageHeader } from "@/components/shared/page-header";

export default function PessoasLoading(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pessoas" />
      <PeopleSkeleton />
    </div>
  );
}

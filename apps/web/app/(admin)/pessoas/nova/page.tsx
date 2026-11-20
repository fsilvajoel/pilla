import type { ReactElement } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PersonForm } from "@/components/people/person-form";
import { Card, CardContent } from "@/components/ui/card";

export default function NovaPessoaPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader title="Nova pessoa" description="Cadastre uma nova pessoa no sistema." />
      <Card>
        <CardContent className="pt-6">
          <PersonForm />
        </CardContent>
      </Card>
    </div>
  );
}

import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PersonForm } from "@/components/people/person-form";
import { Card, CardContent } from "@/components/ui/card";
import { getPerson } from "@/lib/api/people";
import { ApiProblem } from "@/lib/api/problem";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarPessoaPage({ params }: PageProps): Promise<ReactElement> {
  const { id } = await params;
  const person = await getPerson(id).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status === 404) return notFound();
    throw error;
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Editar pessoa" description={`Editando ${person.fullName}`} />
      <Card>
        <CardContent className="pt-6">
          <PersonForm person={person} />
        </CardContent>
      </Card>
    </div>
  );
}

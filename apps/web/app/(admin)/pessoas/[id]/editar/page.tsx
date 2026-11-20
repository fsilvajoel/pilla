import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { PersonForm } from "@/components/people/person-form";
import { PageHeader } from "@/components/shared/page-header";
import { getPerson } from "@/lib/api/people";
import { ApiProblem } from "@/lib/api/problem";
import { searchPeopleAction, updatePersonAction } from "../../actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPersonPage({ params }: PageProps): Promise<ReactElement> {
  const { id } = await params;
  const person = await getPerson(id).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Editar pessoa" description={person.fullName} />
      <PersonForm
        mode="edit"
        personId={person.id}
        version={person.version}
        referrer={person.referrer}
        initialValues={{
          fullName: person.fullName,
          cpf: person.cpf,
          phone: person.phone,
          email: person.email ?? "",
          birthDate: person.birthDate ?? "",
          referredById: "",
          notes: person.notes ?? "",
        }}
        onUpdate={updatePersonAction}
        onSearch={searchPeopleAction}
      />
    </div>
  );
}

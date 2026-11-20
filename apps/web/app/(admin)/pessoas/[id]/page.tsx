import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { PersonSheet } from "@/components/people/person-sheet";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getPerson } from "@/lib/api/people";
import { ApiProblem } from "@/lib/api/problem";
import {
  addAddressAction,
  updateAddressAction,
  deleteAddressAction,
  addPixKeyAction,
  updatePixKeyAction,
  deletePixKeyAction,
  setPrimaryAddressAction,
  setPrimaryPixKeyAction,
} from "../actions";
import type { PersonDetailResponse } from "@pilla/schemas";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PessoaPage({ params }: PageProps): Promise<ReactElement> {
  const { id } = await params;

  let person: PersonDetailResponse;
  try {
    person = await getPerson(id);
  } catch (error) {
    if (error instanceof ApiProblem && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={person.fullName}
        description={`CPF: ${person.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/pessoas/${person.id}/editar`}>Editar pessoa</Link>
          </Button>
        }
      />
      <PersonSheet
        person={person}
        onAddAddress={addAddressAction.bind(null, person.id)}
        onUpdateAddress={updateAddressAction}
        onDeleteAddress={deleteAddressAction}
        onSetPrimaryAddress={setPrimaryAddressAction.bind(null, person.id)}
        onAddPixKey={addPixKeyAction.bind(null, person.id)}
        onUpdatePixKey={updatePixKeyAction}
        onDeletePixKey={deletePixKeyAction}
        onSetPrimaryPixKey={setPrimaryPixKeyAction.bind(null, person.id)}
      />
    </div>
  );
}

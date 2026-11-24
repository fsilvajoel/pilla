import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { PortalAccessCard } from "@/components/people/portal-access-card";
import { PersonSheet } from "@/components/people/person-sheet";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getPerson } from "@/lib/api/people";
import { getPortalAccess, type PortalAccessResponse } from "@/lib/api/portal-access";
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
  setPortalAccessAction,
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

  let portalAccess: PortalAccessResponse | null = null;
  try {
    portalAccess = await getPortalAccess(person.id);
  } catch {
    // A ficha abre mesmo sem o estado do acesso; o cartão mostra o aviso e deixa a chave desligada.
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
      <PortalAccessCard
        personId={person.id}
        hasCpf={Boolean(person.cpf)}
        initial={portalAccess}
        onChange={setPortalAccessAction}
      />
    </div>
  );
}

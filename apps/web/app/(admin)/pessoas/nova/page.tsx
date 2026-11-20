import type { ReactElement } from "react";
import { PersonForm } from "@/components/people/person-form";
import { PageHeader } from "@/components/shared/page-header";
import { createPersonAction, searchPeopleAction } from "../actions";

export default function NewPersonPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nova pessoa" description="Cadastro de cliente ou indicador." />
      <PersonForm mode="create" onCreate={createPersonAction} onSearch={searchPeopleAction} />
    </div>
  );
}

import type { ReactElement } from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PeopleSearchProps = { search: string };

/** Formulário GET: escreve ?search= e volta para a primeira página. */
export function PeopleSearch({ search }: PeopleSearchProps): ReactElement {
  return (
    <form action="/pessoas" method="get" role="search" className="flex w-full max-w-md gap-2">
      <Input
        type="search"
        name="search"
        defaultValue={search}
        placeholder="Buscar por nome ou CPF"
        aria-label="Buscar pessoas"
      />
      <Button type="submit" variant="outline">
        <SearchIcon aria-hidden="true" />
        Buscar
      </Button>
    </form>
  );
}

import type { ReactElement } from "react";
import Link from "next/link";
import { UsersIcon } from "lucide-react";
import { PeopleSearch } from "@/components/people/people-search";
import { PeopleTable } from "@/components/people/people-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listPeople, type ListPeopleParams } from "@/lib/api/people";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ?? "";
}

export default async function PessoasPage({ searchParams }: PageProps): Promise<ReactElement> {
  const raw = await searchParams;
  const search = first(raw.search);
  const cursor = first(raw.cursor);

  const params: ListPeopleParams = {};
  if (search) params.search = search;
  if (cursor) params.cursor = cursor;
  const { items, nextCursor } = await listPeople(params);

  const nextQuery = new URLSearchParams();
  if (search) nextQuery.set("search", search);
  if (nextCursor) nextQuery.set("cursor", nextCursor);

  const newPerson = (
    <Button asChild>
      <Link href="/pessoas/nova">Nova pessoa</Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pessoas" description="Cadastro de clientes e indicadores." actions={newPerson} />
      <PeopleSearch search={search} />
      {items.length === 0 && !cursor ? (
        <EmptyState
          icon={UsersIcon}
          text={search ? "Nenhuma pessoa encontrada para essa busca." : "Nenhuma pessoa cadastrada ainda."}
          action={newPerson}
        />
      ) : (
        <>
          <PeopleTable people={items} />
          {nextCursor && (
            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <Link href={`/pessoas?${nextQuery.toString()}`}>Carregar mais</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

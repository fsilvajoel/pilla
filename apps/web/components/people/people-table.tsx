import type { ReactElement } from "react";
import Link from "next/link";
import type { PersonSummary } from "@pilla/schemas";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCpf, formatPhone } from "./format";

const columns: readonly DataTableColumn<PersonSummary>[] = [
  { key: "name", header: "Nome", cell: (p) => <span className="font-medium">{p.fullName}</span> },
  { key: "cpf", header: "CPF", cell: (p) => <span className="font-mono text-sm">{formatCpf(p.cpf)}</span> },
  { key: "phone", header: "Telefone", cell: (p) => formatPhone(p.phone) },
  {
    key: "status",
    header: "Situação",
    cell: (p) => <Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Ativa" : "Inativa"}</Badge>,
  },
  {
    key: "sheet",
    header: "Ficha",
    cell: (p) => (
      <Link href={`/pessoas/${p.id}`} className="text-primary text-sm font-medium hover:underline">
        Abrir ficha
      </Link>
    ),
  },
];

export type PeopleTableProps = { people: readonly PersonSummary[] };

export function PeopleTable({ people }: PeopleTableProps): ReactElement {
  return <DataTable columns={columns} rows={people} getRowKey={(p) => p.id} emptyText="Nenhuma pessoa encontrada." />;
}

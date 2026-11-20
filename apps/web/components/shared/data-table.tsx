import type { ReactElement, ReactNode } from "react";

export type DataTableColumn<Row> = { key: string; header: string; cell: (row: Row) => ReactNode };

export type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  emptyText: string;
};

export function DataTable<Row>(_props: DataTableProps<Row>): ReactElement {
  throw new Error("esboço: não implementado");
}

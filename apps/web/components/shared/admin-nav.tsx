"use client";
import type { ReactElement } from "react";

export const ADMIN_NAV_ITEMS: readonly { label: string; href: string }[] = [
  { label: "Pessoas", href: "/pessoas" },
  { label: "Empréstimos", href: "/emprestimos" },
];

export function AdminNav(): ReactElement {
  throw new Error("esboço: não implementado");
}

import type { ReactElement, ReactNode } from "react";
import { AdminShell } from "@/components/shared/admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  return <AdminShell>{children}</AdminShell>;
}

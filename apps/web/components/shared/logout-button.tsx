import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logoutAdmin } from "@/lib/api/auth";
import { clearSessionToken } from "@/lib/api/session";

async function logout(): Promise<void> {
  "use server";
  try {
    await logoutAdmin();
  } finally {
    await clearSessionToken();
  }
  redirect("/login");
}

export function LogoutButton(): ReactElement {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm">
        Sair
      </Button>
    </form>
  );
}

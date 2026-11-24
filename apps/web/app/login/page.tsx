import type { ReactElement } from "react";
import { safeNextPath } from "@/lib/api/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar | pilla" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const raw = params.next;
  const next = safeNextPath(typeof raw === "string" ? raw : undefined);
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">pilla</h1>
        <LoginForm next={next} />
      </div>
    </main>
  );
}

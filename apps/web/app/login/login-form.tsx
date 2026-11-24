"use client";

import { useActionState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { loginAction, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({ next }: { next: string }): ReactElement {
  const [state, action, pending] = useActionState(loginAction, INITIAL);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormField id="username" label="Usuário">
        <Input name="username" type="text" autoComplete="username" required maxLength={100} />
      </FormField>
      <FormField id="password" label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </FormField>
      <p role="alert" className="min-h-5 text-sm text-destructive">
        {state.error}
      </p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

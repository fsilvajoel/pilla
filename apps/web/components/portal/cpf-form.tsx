"use client";

import { useActionState, type ReactElement } from "react";
import { enterAction, type EnterState } from "@/app/(portal)/portal/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { portalTexts } from "@/lib/portal-texts";

const initialState: EnterState = { error: null };

export function CpfForm({ notice }: { notice: string | null }): ReactElement {
  const [state, formAction, pending] = useActionState(enterAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{portalTexts.entry.title}</CardTitle>
        <CardDescription className="text-base">{portalTexts.entry.instruction}</CardDescription>
      </CardHeader>
      <CardContent>
        {notice !== null && state.error === null && (
          <p role="status" className="mb-4 rounded-md border bg-muted p-3 text-base">
            {notice}
          </p>
        )}
        <form action={formAction} className="space-y-4" noValidate>
          <FormField
            id="cpf"
            label={portalTexts.entry.fieldLabel}
            description={portalTexts.entry.fieldHelp}
            {...(state.error === null ? {} : { error: state.error })}
          >
            <Input
              name="cpf"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              required
              className="h-12 text-lg"
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? portalTexts.entry.submitting : portalTexts.entry.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

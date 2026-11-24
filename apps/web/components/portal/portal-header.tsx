import type { ReactElement } from "react";
import { signOutAction } from "@/app/(portal)/portal/actions";
import { Button } from "@/components/ui/button";
import { portalTexts } from "@/lib/portal-texts";

export function PortalHeader({ signedIn }: { signedIn: boolean }): ReactElement {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <span className="text-lg font-semibold">{portalTexts.appName}</span>
        {signedIn && (
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              {portalTexts.signOut}
            </Button>
          </form>
        )}
      </div>
    </header>
  );
}

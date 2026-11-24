"use client";

import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { portalTexts } from "@/lib/portal-texts";

export default function PortalError({ reset }: { error: Error; reset: () => void }): ReactElement {
  return (
    <div role="alert" className="space-y-4">
      <p className="text-lg">{portalTexts.entry.unexpected}</p>
      <Button onClick={reset}>{portalTexts.entry.tryAgain}</Button>
    </div>
  );
}

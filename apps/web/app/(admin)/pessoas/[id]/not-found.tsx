import type { ReactElement } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound(): ReactElement {
  return (
    <EmptyState
      icon={UsersIcon}
      text="Pessoa não encontrada."
      action={
        <Button asChild>
          <Link href="/pessoas">Voltar à lista</Link>
        </Button>
      }
    />
  );
}

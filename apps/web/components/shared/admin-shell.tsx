import type { ReactElement, ReactNode } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";

export function AdminShell({ username, children }: { username: string; children: ReactNode }): ReactElement {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex h-16 items-center gap-2 px-4">
            <span className="font-semibold text-lg">pilla</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AdminNav />
        </SidebarContent>
        <SidebarFooter>
          <SidebarRail />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center gap-4 border-b px-4">
          <SidebarTrigger className="-ml-4" />
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{username}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-4">{children}</main>
        <Toaster theme="light" />
      </SidebarInset>
    </SidebarProvider>
  );
}

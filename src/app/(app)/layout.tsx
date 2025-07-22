'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'; // Import SidebarInset
import { UserNav } from '@/components/user-nav';


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <SidebarInset> {/* Wrap main content with SidebarInset */}
          <header className="flex h-14 items-center justify-end gap-4 border-b bg-card px-6">
            <UserNav />
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-8">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
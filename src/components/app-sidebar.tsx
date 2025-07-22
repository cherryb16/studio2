'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  CandlestickChart,
  BookOpen,
  Building,
} from 'lucide-react';

const Logo = () => (
    <div className="flex items-center gap-2 p-2">
        <Building className="w-8 h-8 text-primary" />
        <h1 className="text-xl font-bold font-headline text-primary-foreground group-data-[collapsible=icon]:hidden">Trade Insights Pro</h1>
    </div>
);


export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
        <SidebarTrigger className="absolute right-2 top-3 md:hidden" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard">
              <SidebarMenuButton
                tooltip="Dashboard"
                isActive={isActive('/dashboard')}
              >
                <span>
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/trades">
              <SidebarMenuButton
                tooltip="Trades"
                isActive={isActive('/trades')}
              >
                 <span>
                   <CandlestickChart />
                   <span>Trades</span>
                 </span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/journal">
              <SidebarMenuButton
                tooltip="Journal"
                isActive={isActive('/journal')}
              >
                 <span>
                   <BookOpen />
                   <span>Journal</span>
                 </span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="text-xs text-sidebar-foreground/50 p-4">
            © {new Date().getFullYear()} Trade Insights Pro
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

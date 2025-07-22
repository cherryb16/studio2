'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ConnectBrokerageButton } from "./connect-brokerage-button";
import UserNav from './user-nav';

const mainNav = [
  {
    href: '/dashboard',
    title: 'Dashboard',
    icon: 'layout-dashboard',
  },
  {
    href: '/trades',
    title: 'Trades',
    icon: 'line-chart',
  },
  {
    href: '/journal',
    title: 'Journal',
    icon: 'book',
  },
  {
    href: '/positions',
    title: 'Positions',
    icon: 'package',
  },
];

export default function AppSidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="hidden border-r bg-muted/40 md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                         <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-6 w-6"
                        >
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <path d="M6 4v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4"></path>
                             <path d="M10 14l4 4"></path>
                             <path d="M14 14l-4 4"></path>
                         </svg>
                        <span className="">AITrader</span>
                    </Link>
                </div>
                <div className="flex-1">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {mainNav.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary',
                                    pathname === item.href ? 'bg-muted text-primary' : 'text-muted-foreground'
                                )}
                            >
                                 <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                     {/* Icon paths go here based on item.icon */}
                                     {item.icon === 'layout-dashboard' && <path d="M3 3h18v18H3zM9 3v18M9 3a6 6 0 0 0 6 6M9 21a6 6 0 0 0 6-6"></path>}
                                     {item.icon === 'line-chart' && <path d="M3 3h18v18H3zM9 3v18M9 3a6 6 0 0 0 6 6M9 21a6 6 0 0 0 6-6"></path>}
                                     {item.icon === 'book' && <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>}
                                     {item.icon === 'package' && <path d="M3 3h18v18H3zM9 3v18M9 3a6 6 0 0 0 6 6M9 21a6 6 0 0 0 6-6"></path>}
                                </svg>
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="mt-auto p-4">
                    <ConnectBrokerageButton />
                     <div className="pt-4">
                         <UserNav />
                    </div>
                </div>
            </div>
        </div>
    );
}

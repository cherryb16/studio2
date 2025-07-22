import Link from "next/link";
import { ConnectBrokerageButton } from "./connect-brokerage-button";

interface AppSidebarProps {
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    uid: string;
  } | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col space-y-4 py-4">
      <div className="px-3 py-2">
        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
          Overview
        </h2>
        <div className="flex flex-col space-y-1">
          <Link href="/dashboard" className="flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-100">
            Dashboard
          </Link>
          <Link href="/journal" className="flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-100">
            Journal
          </Link>
          <Link href="/trades" className="flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-100">
            Trades
          </Link>
          <Link href="/positions" className="flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-100">
            Positions
          </Link>
        </div>
      </div>
      <div className="px-3 py-2">
        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
          Brokerage
        </h2>
        <div className="flex flex-col space-y-1">
          <Link href="#" passHref>
            <ConnectBrokerageButton user={user} />
          </Link>
        </div>
      </div>
      {/* Add more navigation sections or links here if needed */}
    </div>
  );
}

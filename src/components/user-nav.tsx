import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { UserIcon, LogOut } from 'lucide-react';
import Link from 'next/link';
import { getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';


interface UserNavProps {
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
}

export function UserNav({ user }: UserNavProps) {
  const { logOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            {user?.photoURL ? (
              <AvatarImage src={user.photoURL} alt={user.displayName ?? 'User'} />
            ) : (
              <AvatarFallback>{getInitials(user?.displayName ?? user?.email)}</AvatarFallback>
            )}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.displayName ?? 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <div>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </div>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

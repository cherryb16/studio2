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

import { UserIcon } from 'lucide-react'; // Assuming UserIcon is imported from lucide-react
import Link from 'next/link'; // Assuming Link is imported from next/link


// Function to get initials from display name or email
// This is a placeholder function, replace with your actual implementation
const getInitials = (nameOrEmail?: string | null): string => {
  if (!nameOrEmail) return "";

  const parts = nameOrEmail.split('@')[0].split(' ');
  let initials = "";
  for (const part of parts) {
    if (part.length > 0) {
      initials += part[0];
    }
  }
  return initials.toUpperCase();
};


interface UserNavProps {
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
}

export function UserNav({ user }: UserNavProps) {
  // If getInitials is not defined here, it should be imported.
  // For example: import { getInitials } from "@/lib/utils";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.photoURL ?? ''} alt={user?.displayName ?? 'User'} />
            <AvatarFallback>{getInitials(user?.displayName ?? user?.email)}</AvatarFallback>
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
          <DropdownMenuItem asChild> {/* Use asChild to make it a Link */}
            <Link href="/settings"> {/* Link to the settings page */}
              <div> {/* Added a div to wrap the icon and text */}
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </div>
            </Link>
          </DropdownMenuItem>
          {/* Add other DropdownMenuItems here */}
        </DropdownMenuGroup>
        {/* Add other DropdownMenu content here */}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


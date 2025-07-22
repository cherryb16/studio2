'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSnapTradeLoginUrl } from '@/app/actions/snaptrade';
import { Button } from '@/components/ui/button';

interface ConnectBrokerageButtonProps {
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    uid: string;
  } | null;
}

export function ConnectBrokerageButton({ user }: ConnectBrokerageButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      if (!user?.uid) {
        console.error('User not logged in or UID not available.');
        // Show an error message to the user
        return;
      }
      const result = await getSnapTradeLoginUrl(user.uid);
      if (result.error) {
        console.error('Error getting SnapTrade login URL:', result.error);
        // Show an error message to the user
      } else if (result.url) { // Access url directly
        router.push(result.url); // Use url directly
      }
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending || !user?.uid}
      className="flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-100 w-full justify-start"
      variant="ghost"
    >
      {isPending ? 'Connecting...' : 'Connect Brokerage'}
    </Button>
  );
}

'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getSnapTradeLoginUrl } from '@/app/actions/snaptrade';
import { toast } from './ui/use-toast';
import { Icons } from './icons';

export default function ConnectBrokerageButton() {
    const { user } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnectBrokerage = async () => {
        if (!user) return;
        setIsConnecting(true);
        try {
            const result = await getSnapTradeLoginUrl(user.uid);
            if (result.data?.redirectUrl) {
                window.location.href = result.data.redirectUrl;
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Connection Failed',
                    description: result.error || 'Could not get brokerage connection link.',
                });
            }
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Connection Error',
                description: 'An unexpected error occurred.',
            });
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <Button
            onClick={handleConnectBrokerage}
            disabled={isConnecting}
        >
            {isConnecting && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Connect Brokerage
        </Button>
    );
}

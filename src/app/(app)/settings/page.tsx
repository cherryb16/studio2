// src/app/(app)/settings/page.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConnectBrokerageButton } from '@/components/connect-brokerage-button';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const SettingsPage = () => {
  const { user, logOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-trigger brokerage connection for new users
  useEffect(() => {
    const shouldConnect = searchParams.get('connect');
    if (shouldConnect === 'true' && connectButtonRef.current) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        connectButtonRef.current?.click();
      }, 500);
    }
  }, [searchParams]);

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm('This will permanently delete your account. Continue?')) return;
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid }),
    });
    if (res.ok) {
      await logOut();
      router.push('/login');
    } else {
      console.error('Failed to delete account');
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><span className="font-medium">Email:</span> {user?.email ?? 'N/A'}</p>
          <p><span className="font-medium">User ID:</span> {user?.uid ?? 'N/A'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brokerage Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>Connect your brokerage account to enable trading features.</p>
          <ConnectBrokerageButton ref={connectButtonRef} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete}>
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
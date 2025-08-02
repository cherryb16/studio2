// src/app/(app)/settings/page.tsx
'use client';

import React from 'react';
import { ConnectBrokerageButton } from '@/components/connect-brokerage-button';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const SettingsPage = () => {
  const { user } = useAuth();

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
          <ConnectBrokerageButton />
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
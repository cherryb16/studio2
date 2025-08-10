'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Database } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

export default function SyncButton() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get SnapTrade credentials
  const { data: snaptradeCredentials } = useQuery({
    queryKey: ['snaptradeCredentials', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error('No user ID');
      const res = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      return res.json();
    },
    enabled: !!user?.uid,
  });

  const handleSync = async (fullSync = false) => {
    if (!snaptradeCredentials?.snaptradeUserId || !snaptradeCredentials?.userSecret) {
      setError('SnapTrade credentials not found. Please connect your brokerage first.');
      return;
    }

    if (!user) {
      setError('User not authenticated');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      // Get Firebase auth token
      console.log('Getting Firebase auth token...');
      const token = await user.getIdToken();
      console.log('Token obtained, making sync request...');

      const requestBody = {
        userId: user.uid,
        snaptradeUserId: snaptradeCredentials.snaptradeUserId,
        userSecret: snaptradeCredentials.userSecret,
        fullSync,
      };

      console.log('Sync request:', { ...requestBody, userSecret: '***hidden***' });

      const response = await fetch('/api/sync-firestore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response body:', result);

      if (!response.ok) {
        throw new Error(result.error || `Sync failed: ${response.status}`);
      }

      setLastSync(new Date());
      console.log('Sync completed successfully:', result);
      
      // Show success message briefly
      if (result.synced) {
        console.log(`Synced ${result.synced.positions} positions, ${result.synced.trades} trades`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => handleSync(false)}
        disabled={syncing}
        variant="outline"
        size="sm"
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Quick Sync
      </Button>
      
      <Button
        onClick={() => handleSync(true)}
        disabled={syncing}
        variant="outline"
        size="sm"
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Database className="h-4 w-4 mr-2" />
        )}
        Full Sync
      </Button>

      {lastSync && (
        <Badge variant="secondary" className="text-xs">
          Last sync: {lastSync.toLocaleTimeString()}
        </Badge>
      )}

      {error && (
        <Badge variant="destructive" className="text-xs">
          Error: {error}
        </Badge>
      )}
    </div>
  );
}
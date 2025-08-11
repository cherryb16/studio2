// src/app/(app)/settings/page.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConnectBrokerageButton } from '@/components/connect-brokerage-button';
import { SubscriptionManagement } from '@/components/subscription-management';
import { useAuth } from '@/hooks/use-auth';
import { useCachedAccounts } from '@/hooks/use-cached-accounts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const SettingsPage = () => {
  const { user, logOut } = useAuth();
  const { accounts, isLoading: accountsLoading } = useCachedAccounts();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [resetOnboardingLoading, setResetOnboardingLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.uid) return;
      
      try {
        const response = await fetch(`/api/firebase/getUserData?firebaseUserId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchUserProfile();
  }, [user?.uid]);

  // Auto-trigger brokerage connection for new users
  useEffect(() => {
    const shouldConnect = searchParams?.get('connect');
    if (shouldConnect === 'true' && connectButtonRef.current) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        connectButtonRef.current?.click();
      }, 500);
    }
  }, [searchParams]);

  const handleSyncData = useCallback(async () => {
    if (!user) return;
    
    setSyncLoading(true);
    try {
      // Use the new BigQuery-powered refresh endpoint
      const response = await fetch('/api/portfolio/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      const result = await response.json();
      if (response.ok) {
        console.log('BigQuery sync completed:', result.message);
        // Optionally refresh the page or update the UI
        window.location.reload();
      } else {
        console.error('BigQuery sync failed:', result.error);
        // Fallback to old sync method if BigQuery fails
        console.log('Falling back to Firestore sync...');
        const fallbackResponse = await fetch('/api/sync-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        });
        
        const fallbackResult = await fallbackResponse.json();
        if (fallbackResponse.ok) {
          console.log('Firestore sync completed:', fallbackResult.message);
          window.location.reload();
        } else {
          console.error('Both sync methods failed:', fallbackResult.error);
        }
      }
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      setSyncLoading(false);
    }
  }, [user]);

  // Auto-trigger data sync after successful account connection
  useEffect(() => {
    const status = searchParams?.get('status');
    const connectionId = searchParams?.get('connection_id');
    
    if (status === 'SUCCESS' && connectionId && user?.uid) {
      console.log(`SnapTrade connection successful! Connection ID: ${connectionId}`);
      console.log('Triggering automatic data sync...');
      
      // Trigger sync after a short delay to ensure credentials are saved
      setTimeout(() => {
        handleSyncData();
      }, 2000); // 2 second delay to ensure credentials are stored
    }
  }, [searchParams, user?.uid, handleSyncData]);

  const handleResetOnboarding = async () => {
    if (!user) return;
    if (!confirm('This will reset your trading profile and you\'ll need to complete the onboarding again. Continue?')) return;
    
    setResetOnboardingLoading(true);
    try {
      const response = await fetch('/api/firebase/resetOnboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      if (response.ok) {
        // Refresh the page to trigger onboarding
        window.location.reload();
      } else {
        console.error('Failed to reset onboarding');
      }
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    } finally {
      setResetOnboardingLoading(false);
    }
  };

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
        <CardContent className="space-y-4">
          <div>
            <span className="font-medium">Email:</span> {user?.email ?? 'N/A'}
          </div>
          
          <div>
            <span className="font-medium">Trading Experience:</span>
            {profileLoading ? (
              <Skeleton className="h-4 w-24 ml-2 inline-block" />
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {userProfile?.tradingExperience || 'Not set'}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResetOnboarding}
                  disabled={resetOnboardingLoading}
                >
                  {resetOnboardingLoading ? 'Resetting...' : 'Retake Assessment'}
                </Button>
              </div>
            )}
          </div>
          
          <div>
            <span className="font-medium">Connected Accounts:</span>
            <div className="mt-2">
              {accountsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : accounts.length > 0 ? (
                <div className="space-y-2">
                  {accounts.map((account: any, index: number) => (
                    <div key={account.id || index} className="flex items-center gap-2">
                      <Badge variant="outline">
                        {account.institution_name || 'Unknown Institution'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {account.name || 'Unnamed Account'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No accounts connected</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SubscriptionManagement />

      <Card>
        <CardHeader>
          <CardTitle>Brokerage Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Connect your brokerage account to enable trading features.</p>
          <ConnectBrokerageButton ref={connectButtonRef} />
          
          {accounts.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Sync your trading data to BigQuery for analytics and faster performance
              </p>
              <Button 
                variant="secondary" 
                onClick={handleSyncData}
                disabled={syncLoading}
              >
                {syncLoading ? 'Syncing to BigQuery...' : 'Sync Trading Data (BigQuery)'}
              </Button>
            </div>
          )}
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
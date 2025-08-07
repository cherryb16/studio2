'use client';

import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Zap, Calendar, CreditCard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function SubscriptionManagement() {
  const { data: subscription, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  const plan = subscription?.plan || 'free';
  const status = subscription?.status;

  const planConfig = {
    free: {
      name: 'Free',
      icon: null,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
    pro: {
      name: 'Pro',
      icon: <Zap className="h-4 w-4 text-blue-500" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    premium: {
      name: 'Premium',
      icon: <Crown className="h-4 w-4 text-purple-500" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  };

  const config = planConfig[plan];
  const isSubscribed = plan !== 'free';

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getStatusBadge = () => {
    if (subscription?.isAdmin) {
      return <Badge variant="default">👑 Admin</Badge>;
    }
    if (subscription?.isTesting) {
      return <Badge variant="secondary">🧪 Testing</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'unpaid':
        return <Badge variant="destructive">Unpaid</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>
          Manage your Trade Insights Pro subscription
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              {config.icon || <CreditCard className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{config.name} Plan</span>
                {getStatusBadge()}
              </div>
              <p className="text-sm text-muted-foreground">
                {plan === 'free' 
                  ? 'Basic features with limited usage'
                  : `Full access to ${config.name.toLowerCase()} features`
                }
              </p>
            </div>
          </div>
          
          {plan === 'free' ? (
            <Link href="/pricing">
              <Button>Upgrade</Button>
            </Link>
          ) : (
            <Link href="/pricing">
              <Button variant="outline">Change Plan</Button>
            </Link>
          )}
        </div>

        {/* Subscription Details */}
        {isSubscribed && subscription && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium">Subscription Details</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              {subscription.current_period_end && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">
                      {subscription.cancel_at_period_end ? 'Expires' : 'Renews'} on
                    </p>
                    <p className="font-medium">
                      {formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  status === 'active' ? 'bg-green-500' : 
                  status === 'canceled' ? 'bg-orange-500' : 
                  'bg-red-500'
                }`} />
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{status || 'Free'}</p>
                </div>
              </div>
            </div>

            {/* Cancellation Warning */}
            {subscription.cancel_at_period_end && (
              <div className="flex items-start gap-3 p-3 border border-orange-200 bg-orange-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800">
                    Subscription Ending
                  </p>
                  <p className="text-orange-700">
                    Your subscription will end on {formatDate(subscription.current_period_end)}. 
                    You'll lose access to premium features.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Usage/Limits Info */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Plan Limits</h4>
          <div className="space-y-2 text-sm">
            {plan === 'free' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected Accounts</span>
                  <span>Up to 3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trade History</span>
                  <span>30 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advanced Analytics</span>
                  <span>❌</span>
                </div>
              </>
            ) : plan === 'pro' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected Accounts</span>
                  <span>Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trade History</span>
                  <span>Full History</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Insights</span>
                  <span>❌</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected Accounts</span>
                  <span>Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">All Features</span>
                  <span>✅</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority Support</span>
                  <span>✅</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t pt-4 flex gap-3">
          <Link href="/pricing">
            <Button variant="outline" size="sm">
              View All Plans
            </Button>
          </Link>
          {isSubscribed && (
            <Button variant="outline" size="sm" className="text-destructive">
              Cancel Subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
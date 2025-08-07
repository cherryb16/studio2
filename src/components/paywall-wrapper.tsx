'use client';

import { ReactNode } from 'react';
import { useSubscription, hasAccess, SubscriptionPlan } from '@/hooks/use-subscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Crown, Zap, Lock } from 'lucide-react';
import Link from 'next/link';

interface PaywallWrapperProps {
  requiredPlan: SubscriptionPlan;
  children: ReactNode;
  feature?: string;
  description?: string;
}

export function PaywallWrapper({ 
  requiredPlan, 
  children, 
  feature,
  description 
}: PaywallWrapperProps) {
  const { data: subscription, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const userPlan = subscription?.plan || 'free';
  const userHasAccess = hasAccess(userPlan, requiredPlan);

  // Show admin/testing badge if applicable
  const AdminBadge = () => {
    if (subscription?.isAdmin) {
      return <Badge variant="default" className="mb-2">👑 Admin Access</Badge>;
    }
    if (subscription?.isTesting) {
      return <Badge variant="secondary" className="mb-2">🧪 Testing Access</Badge>;
    }
    return null;
  };

  if (userHasAccess) {
    return (
      <div>
        <AdminBadge />
        {children}
      </div>
    );
  }

  const planConfig = {
    pro: {
      icon: <Zap className="h-8 w-8 text-blue-500" />,
      color: 'text-blue-500',
      name: 'Pro',
    },
    premium: {
      icon: <Crown className="h-8 w-8 text-purple-500" />,
      color: 'text-purple-500',
      name: 'Premium',
    },
  };

  const config = planConfig[requiredPlan as keyof typeof planConfig] || {
    icon: <Lock className="h-8 w-8 text-gray-500" />,
    color: 'text-gray-500',
    name: requiredPlan,
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center pb-6">
        <div className="flex justify-center mb-4">
          {config.icon}
        </div>
        <CardTitle className="text-2xl">
          {feature ? `${feature} requires ` : 'Upgrade to '}
          <span className={config.color}>{config.name}</span>
        </CardTitle>
        <CardDescription className="text-base">
          {description || 
            `This feature is available for ${config.name} subscribers. Upgrade your plan to unlock advanced trading analytics and insights.`
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-center space-y-4">
        <div className="flex justify-center gap-4">
          <Link href="/pricing">
            <Button size="lg" className="min-w-[120px]">
              Upgrade Now
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg">
              View Plans
            </Button>
          </Link>
        </div>
        
        <p className="text-sm text-muted-foreground mt-4">
          Current plan: <Badge variant="outline">{userPlan}</Badge>
        </p>
      </CardContent>
    </Card>
  );
}
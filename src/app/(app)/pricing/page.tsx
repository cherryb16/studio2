'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSubscription, getPlanFeatures } from '@/hooks/use-subscription';
import { useAuth } from '@/hooks/use-auth';
import { Check, Zap, Crown, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();

  const plans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for getting started',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: getPlanFeatures('free'),
      popular: false,
      icon: null,
      stripePriceId: null,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Advanced analytics and insights',
      monthlyPrice: 29,
      yearlyPrice: 290, // ~$24/month
      features: getPlanFeatures('pro'),
      popular: true,
      icon: <Zap className="h-5 w-5 text-blue-500" />,
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
        yearly: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
      },
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'AI-powered trading optimization',
      monthlyPrice: 79,
      yearlyPrice: 790, // ~$66/month
      features: getPlanFeatures('premium'),
      popular: false,
      icon: <Crown className="h-5 w-5 text-purple-500" />,
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID,
        yearly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_YEARLY_PRICE_ID,
      },
    },
  ];

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to subscribe.',
        variant: 'destructive',
      });
      return;
    }

    if (plan.id === 'free') {
      return; // Free plan doesn't need subscription
    }

    setLoading(plan.id);

    try {
      const priceId = isYearly ? plan.stripePriceId?.yearly : plan.stripePriceId?.monthly;
      
      if (!priceId) {
        throw new Error('Price ID not configured');
      }

      // Create checkout session using Firebase Stripe extension
      const checkoutSessionRef = collection(db, 'customers', user.uid, 'checkout_sessions');
      
      await addDoc(checkoutSessionRef, {
        price: priceId,
        success_url: `${window.location.origin}/settings?success=true`,
        cancel_url: `${window.location.origin}/pricing`,
        allow_promotion_codes: true,
      });

      toast({
        title: 'Redirecting to checkout...',
        description: 'Please wait while we prepare your subscription.',
      });

    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: 'Error',
        description: 'Failed to start checkout process. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const currentPlan = subscription?.plan || 'free';
  const isCurrentPlan = (planId: string) => currentPlan === planId;

  if (subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Unlock advanced trading analytics and insights
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-3">
          <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : ''}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isYearly}
            onCheckedChange={setIsYearly}
          />
          <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : ''}>
            Yearly
          </Label>
          {isYearly && (
            <Badge variant="secondary" className="ml-2">
              Save up to 17%
            </Badge>
          )}
        </div>
      </div>

      {/* Current Plan Status */}
      {subscription && (
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2">
            <span className="text-muted-foreground">Current plan:</span>
            <Badge variant={currentPlan === 'free' ? 'outline' : 'default'}>
              {currentPlan} {subscription.isAdmin && '(Admin)'} {subscription.isTesting && '(Testing)'}
            </Badge>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
          const isCurrentUserPlan = isCurrentPlan(plan.id);
          
          return (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="px-3 py-1">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {plan.icon}
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                </div>
                <CardDescription className="text-base mb-4">
                  {plan.description}
                </CardDescription>
                
                <div className="space-y-1">
                  <div className="text-4xl font-bold">
                    ${price}
                    {plan.id !== 'free' && (
                      <span className="text-base font-normal text-muted-foreground">
                        /{isYearly ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  {isYearly && plan.id !== 'free' && (
                    <div className="text-sm text-muted-foreground">
                      ~${Math.round(price / 12)}/month billed annually
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Features List */}
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {/* CTA Button */}
                <div className="pt-4">
                  {isCurrentUserPlan ? (
                    <Button disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan)}
                      disabled={loading !== null}
                      className={`w-full ${plan.popular ? 'bg-primary' : ''}`}
                      variant={plan.id === 'free' ? 'outline' : 'default'}
                    >
                      {loading === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {plan.id === 'free' ? 'Get Started Free' : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="text-center mt-12 space-y-4">
        <p className="text-muted-foreground">
          All plans include a 14-day free trial. Cancel anytime.
        </p>
        <p className="text-sm text-muted-foreground">
          Questions? Contact support at support@tradeinsightspro.com
        </p>
      </div>
    </div>
  );
}
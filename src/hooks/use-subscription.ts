import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export type SubscriptionPlan = 'free' | 'pro' | 'premium';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | null;

export interface UserSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  isAdmin?: boolean;
  isTesting?: boolean;
}

// Admin/testing user emails - add your email here
const ADMIN_EMAILS = [
  'braydenmcherry@gmail.com', // Add your email here
  // Add other admin emails as needed
];

// Testing bypass emails - users who get premium access for testing
const TESTING_EMAILS = [
  'test@example.com',
  // Add testing emails here
];

export function useSubscription() {
  const { user } = useAuth();

  return useQuery<UserSubscription>({
    queryKey: ['subscription', user?.uid],
    queryFn: async () => {
      if (!user?.uid || !user?.email) {
        return { plan: 'free', status: null };
      }

      // Check if user is admin
      const isAdmin = ADMIN_EMAILS.includes(user.email);
      const isTesting = TESTING_EMAILS.includes(user.email);

      // Admin and testing users get premium access
      if (isAdmin || isTesting) {
        return {
          plan: 'premium' as SubscriptionPlan,
          status: 'active' as SubscriptionStatus,
          isAdmin,
          isTesting
        };
      }

      try {
        // Check for active subscription in Stripe customers collection
        const customerRef = doc(db, 'customers', user.uid);
        const customerDoc = await getDoc(customerRef);

        if (!customerDoc.exists()) {
          return { plan: 'free', status: null };
        }

        // Get active subscriptions
        const subscriptionsRef = collection(db, `customers/${user.uid}/subscriptions`);
        const subscriptionsQuery = query(
          subscriptionsRef,
          where('status', 'in', ['active', 'trialing']),
          orderBy('created', 'desc'),
          limit(1)
        );

        const subscriptionsSnapshot = await getDocs(subscriptionsQuery);

        if (subscriptionsSnapshot.empty) {
          return { plan: 'free', status: null };
        }

        const subscription = subscriptionsSnapshot.docs[0].data();
        
        // Map Stripe price ID to our plan names
        const priceId = subscription.price?.id;
        let plan: SubscriptionPlan = 'free';

        // You'll need to replace these with your actual Stripe price IDs
        if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) {
          plan = 'pro';
        } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID) {
          plan = 'premium';
        }

        return {
          plan,
          status: subscription.status as SubscriptionStatus,
          current_period_end: subscription.current_period_end?.seconds,
          cancel_at_period_end: subscription.cancel_at_period_end,
        };

      } catch (error) {
        console.error('Error fetching subscription:', error);
        return { plan: 'free', status: null };
      }
    },
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function hasAccess(userPlan: SubscriptionPlan, requiredPlan: SubscriptionPlan): boolean {
  const planHierarchy: Record<SubscriptionPlan, number> = {
    free: 0,
    pro: 1,
    premium: 2,
  };

  return planHierarchy[userPlan] >= planHierarchy[requiredPlan];
}

export function getPlanFeatures(plan: SubscriptionPlan) {
  const features = {
    free: [
      'Basic dashboard',
      'Up to 3 connected accounts',
      'Basic position tracking',
      'Limited trade history (30 days)',
    ],
    pro: [
      'Everything in Free',
      'Unlimited connected accounts',
      'Advanced analytics',
      'Trade journal',
      'Full trade history',
      'Performance attribution',
      'Risk analysis',
      'Export data',
    ],
    premium: [
      'Everything in Pro',
      'AI-powered insights',
      'Custom reports',
      'Advanced portfolio optimization',
      'Tax optimization features',
      'Priority support',
      'Early access to new features',
    ],
  };

  return features[plan] || features.free;
}
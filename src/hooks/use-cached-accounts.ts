import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { CacheService } from '@/lib/cache-service';

interface Account {
  id: string;
  name: string;
  institution_name: string;
  [key: string]: any;
}

interface UseCachedAccountsOptions {
  forceRefresh?: boolean;
  staleTime?: number;
}

export function useCachedAccounts(options: UseCachedAccountsOptions = {}) {
  const { user } = useAuth();
  const { forceRefresh = false, staleTime = 5 * 60 * 1000 } = options; // 5 minutes stale time

  // Get SnapTrade credentials
  const { data: credentials } = useQuery({
    queryKey: ['snaptradeCredentials', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error('No user ID');
      const res = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      return res.json() as Promise<{ snaptradeUserId: string; userSecret: string }>;
    },
    enabled: !!user?.uid,
    staleTime: 10 * 60 * 1000, // 10 minutes for credentials
  });

  // Get accounts using cache service
  const accountsQuery = useQuery({
    queryKey: ['cachedAccounts', user?.uid, credentials?.snaptradeUserId, forceRefresh],
    queryFn: async () => {
      try {
        if (!user?.uid || !credentials?.snaptradeUserId || !credentials?.userSecret) {
          return [];
        }

        return await CacheService.getAccounts(
          user.uid,
          credentials.snaptradeUserId,
          credentials.userSecret,
          forceRefresh
        );
      } catch (error) {
        console.error('Error in cached accounts query:', error);
        return [];
      }
    },
    enabled: !!user?.uid && !!credentials?.snaptradeUserId && !!credentials?.userSecret,
    staleTime,
    // Don't refetch on window focus for cached data
    refetchOnWindowFocus: false,
    // Keep cached data while fetching new data
    keepPreviousData: true,
    // Add retry with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const refreshAccounts = () => {
    accountsQuery.refetch();
  };

  const invalidateAccounts = async () => {
    if (user?.uid) {
      await CacheService.invalidateCache(user.uid, 'accounts');
      accountsQuery.refetch();
    }
  };

  return {
    accounts: accountsQuery.data || [],
    isLoading: accountsQuery.isLoading,
    error: accountsQuery.error,
    isCredentialsLoading: !credentials,
    refreshAccounts,
    invalidateAccounts,
  };
}
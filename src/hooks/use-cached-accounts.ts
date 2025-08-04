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

        // Try to get accounts from cache service, but fallback to direct API call if cache fails
        try {
          return await CacheService.getAccounts(
            user.uid,
            credentials.snaptradeUserId,
            credentials.userSecret,
            forceRefresh
          );
        } catch (cacheError) {
          console.warn('Cache service failed, falling back to direct API call:', cacheError);
          
          // Direct API call as fallback
          const response = await fetch(`/api/snaptrade/accounts?snaptradeUserId=${encodeURIComponent(credentials.snaptradeUserId)}&userSecret=${encodeURIComponent(credentials.userSecret)}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch accounts: ${response.status}`);
          }
          
          return await response.json();
        }
      } catch (error) {
        console.error('Error in cached accounts query:', error);
        // Don't throw here - return empty array to prevent UI crashes
        return [];
      }
    },
    enabled: !!user?.uid && !!credentials?.snaptradeUserId && !!credentials?.userSecret,
    staleTime,
    // Don't refetch on window focus for cached data
    refetchOnWindowFocus: false,
    // Add retry with exponential backoff, but reduce retries to avoid Firebase quota issues
    retry: 1,
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
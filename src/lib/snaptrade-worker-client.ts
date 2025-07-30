// src/hooks/useSnapTrade.ts
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { User } from 'firebase/auth';

interface SnapTradeCredentials {
  snaptradeUserId: string;
  userSecret: string;
}

interface UseSnapTradeResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Main hook for SnapTrade positions
export const useSnapTradePositions = (): UseSnapTradeResult<any[]> => {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [credentials, setCredentials] = useState<SnapTradeCredentials | null>(null);

  // Fetch credentials when user changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          const response = await fetch(`/api/snaptrade-credentials?firebaseUserId=${user.uid}`);
          
          if (response.ok) {
            const creds = await response.json();
            setCredentials(creds);
          } else {
            const { error } = await response.json();
            setError(new Error(`Failed to fetch credentials: ${error}`));
            setIsLoading(false);
          }
        } catch (err: any) {
          setError(err);
          setIsLoading(false);
        }
      } else {
        setCredentials(null);
        setData(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch positions when credentials are available
  useEffect(() => {
    const fetchPositions = async () => {
      if (!credentials) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Use your existing server action
        const { getAllPositions } = await import('@/app/actions/snaptrade');
        const result = await getAllPositions(credentials.snaptradeUserId, credentials.userSecret);

        if (result && 'error' in result) {
          setError(new Error(result.error));
          setData(null);
        } else if (result) {
          setData(result as any[]);
          setError(null);
        } else {
          setData([]);
          setError(null);
        }
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, [credentials]);

  const refetch = () => {
    if (credentials) {
      // Trigger re-fetch by updating credentials
      setCredentials({ ...credentials });
    }
  };

  return { data, isLoading, error, refetch };
};

// Hook for SnapTrade accounts
export const useSnapTradeAccounts = (): UseSnapTradeResult<any[]> => {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [credentials, setCredentials] = useState<SnapTradeCredentials | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          const response = await fetch(`/api/snaptrade-credentials?firebaseUserId=${user.uid}`);
          
          if (response.ok) {
            const creds = await response.json();
            setCredentials(creds);
          } else {
            setError(new Error('Failed to fetch credentials'));
            setIsLoading(false);
          }
        } catch (err: any) {
          setError(err);
          setIsLoading(false);
        }
      } else {
        setCredentials(null);
        setData(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!credentials) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { getSnapTradeAccounts } = await import('@/app/actions/snaptrade');
        const result = await getSnapTradeAccounts(credentials.snaptradeUserId, credentials.userSecret);

        if (result && 'error' in result) {
          setError(new Error(result.error));
          setData(null);
        } else if (result) {
          setData(result as any[]);
          setError(null);
        }
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
  }, [credentials]);

  const refetch = () => {
    if (credentials) {
      setCredentials({ ...credentials });
    }
  };

  return { data, isLoading, error, refetch };
};

// Hook for portfolio analytics
export const usePortfolioAnalytics = (): UseSnapTradeResult<any> => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [credentials, setCredentials] = useState<SnapTradeCredentials | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          const response = await fetch(`/api/snaptrade-credentials?firebaseUserId=${user.uid}`);
          
          if (response.ok) {
            const creds = await response.json();
            setCredentials(creds);
          } else {
            setError(new Error('Failed to fetch credentials'));
            setIsLoading(false);
          }
        } catch (err: any) {
          setError(err);
          setIsLoading(false);
        }
      } else {
        setCredentials(null);
        setData(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!credentials) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { getPortfolioAnalytics } = await import('@/app/actions/snaptrade-enhanced');
        const result = await getPortfolioAnalytics(credentials.snaptradeUserId, credentials.userSecret);

        if (result && 'error' in result) {
          setError(new Error(result.error));
          setData(null);
        } else if (result) {
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [credentials]);

  const refetch = () => {
    if (credentials) {
      setCredentials({ ...credentials });
    }
  };

  return { data, isLoading, error, refetch };
};
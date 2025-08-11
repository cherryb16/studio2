// src/hooks/useSnapTrade.ts
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { snaptradeWorker } from '@/lib/snaptrade-worker-client';

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

// Hook for fetching credentials from API
const useSnapTradeCredentials = () => {
  const [credentials, setCredentials] = useState<SnapTradeCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          console.log('Fetching credentials for user:', user.uid);
          const response = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.ok) {
            const creds = await response.json();
            console.log('Credentials fetched successfully:', { 
              hasUserId: !!creds.snaptradeUserId, 
              hasSecret: !!creds.userSecret 
            });
            
            if (creds.snaptradeUserId && creds.userSecret) {
              setCredentials(creds);
              // Set credentials in worker client
              snaptradeWorker.setCredentials(creds.snaptradeUserId, creds.userSecret);
            } else {
              console.error('Credentials response missing required fields');
              setError(new Error('Invalid credentials format'));
            }
          } else {
            const errorData = await response.json();
            console.error('Failed to fetch credentials:', errorData);
            setError(new Error(`Failed to fetch credentials: ${errorData.error || response.statusText}`));
          }
        } catch (err: any) {
          console.error('Error in credential fetch:', err);
          setError(err);
        }
      } else {
        console.log('No authenticated user');
        setCredentials(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { credentials, loading, error };
};

// Main hook for SnapTrade positions using Worker
export const useSnapTradePositions = (): UseSnapTradeResult<any[]> => {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { credentials, loading: credLoading, error: credError } = useSnapTradeCredentials();

  useEffect(() => {
    const fetchPositions = async () => {
      if (credLoading) {
        console.log('Waiting for credentials to load...');
        return;
      }
      
      if (credError) {
        console.error('Credential error:', credError);
        setError(credError);
        setIsLoading(false);
        return;
      }

      if (!credentials) {
        console.log('No credentials available');
        setData(null);
        setIsLoading(false);
        return;
      }

      console.log('Fetching positions with credentials');
      setIsLoading(true);
      try {
        const result = await snaptradeWorker.getPositions();
        console.log('Positions fetched successfully:', Array.isArray(result) ? result.length : 'Not an array');
        setData(result);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching positions:', err);
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, [credentials, credLoading, credError]);

  const refetch = async () => {
    if (!credentials) {
      console.log('Cannot refetch without credentials');
      return;
    }
    
    console.log('Refetching positions...');
    setIsLoading(true);
    try {
      const result = await snaptradeWorker.getPositions();
      setData(result);
      setError(null);
    } catch (err: any) {
      console.error('Error refetching positions:', err);
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
};

// Hook for SnapTrade accounts using Worker
export const useSnapTradeAccounts = (): UseSnapTradeResult<any[]> => {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { credentials, loading: credLoading, error: credError } = useSnapTradeCredentials();

  useEffect(() => {
    const fetchAccounts = async () => {
      if (credLoading) return;
      
      if (credError) {
        setError(credError);
        setIsLoading(false);
        return;
      }

      if (!credentials) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await snaptradeWorker.getAccounts();
        setData(result);
        setError(null);
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
  }, [credentials, credLoading, credError]);

  const refetch = async () => {
    if (!credentials) return;
    
    setIsLoading(true);
    try {
      const result = await snaptradeWorker.getAccounts();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
};

// Hook for portfolio analytics using Worker
export const usePortfolioAnalytics = (accountId?: string): UseSnapTradeResult<any> => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { credentials, loading: credLoading, error: credError } = useSnapTradeCredentials();

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (credLoading) return;
      
      if (credError) {
        setError(credError);
        setIsLoading(false);
        return;
      }

      if (!credentials) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await snaptradeWorker.getAnalytics(accountId);
        setData(result);
        setError(null);
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [credentials, credLoading, credError, accountId]);

  const refetch = async () => {
    if (!credentials) return;
    
    setIsLoading(true);
    try {
      const result = await snaptradeWorker.getAnalytics(accountId);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
};

// Hook for holdings using Worker
export const useSnapTradeHoldings = (accountId?: string): UseSnapTradeResult<any> => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { credentials, loading: credLoading, error: credError } = useSnapTradeCredentials();

  useEffect(() => {
    const fetchHoldings = async () => {
      if (credLoading) return;
      
      if (credError) {
        setError(credError);
        setIsLoading(false);
        return;
      }

      if (!credentials) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await snaptradeWorker.getHoldings(accountId);
        setData(result);
        setError(null);
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHoldings();
  }, [credentials, credLoading, credError, accountId]);

  const refetch = async () => {
    if (!credentials) return;
    
    setIsLoading(true);
    try {
      const result = await snaptradeWorker.getHoldings(accountId);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
};

// Hook for balances using Worker
export const useSnapTradeBalances = (accountId?: string): UseSnapTradeResult<any[]> => {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { credentials, loading: credLoading, error: credError } = useSnapTradeCredentials();

  useEffect(() => {
    const fetchBalances = async () => {
      if (credLoading) return;
      
      if (credError) {
        setError(credError);
        setIsLoading(false);
        return;
      }

      if (!credentials) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await snaptradeWorker.getBalances(accountId);
        setData(result);
        setError(null);
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [credentials, credLoading, credError, accountId]);

  const refetch = async () => {
    if (!credentials) return;
    
    setIsLoading(true);
    try {
      const result = await snaptradeWorker.getBalances(accountId);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
};
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase'; // Import Firebase auth
import { User } from 'firebase/auth'; // Import User type
import { getAllPositions } from '@/app/actions/snaptrade';

export const useSnapTradePositions = () => {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [snaptradeUserId, setSnaptradeUserId] = useState<string | null>(null);
  const [userSecret, setUserSecret] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => { // Add User | null type annotation
      if (user) {
        // Fetch SnapTrade credentials from the existing API endpoint
        try {
          const response = await fetch(`/api/snaptrade-credentials?firebaseUserId=${user.uid}`);

          if (response.ok) {
            const { snaptradeUserId, userSecret } = await response.json();
            setSnaptradeUserId(snaptradeUserId);
            setUserSecret(userSecret);
          } else {
            const { error } = await response.json();
            console.error('Failed to fetch SnapTrade credentials:', error);
            setError(new Error(`Failed to fetch SnapTrade credentials: ${error}`));
            setIsLoading(false);
          }
        } catch (err: any) {
          console.error('Error fetching SnapTrade credentials:', err);
          setError(err);
          setIsLoading(false);
        }
      } else {
        // User is not authenticated, clear credentials and data
        setSnaptradeUserId(null);
        setUserSecret(null);
        setData(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe(); // Cleanup auth listener
  }, []); // Run only on mount and unmount

  useEffect(() => {
    const fetchData = async () => {
      if (!snaptradeUserId || !userSecret) {
        // Don't fetch if credentials are not available yet
        setData(null); // Clear previous data if credentials are lost
        setIsLoading(false);
        return;
      }

      setIsLoading(true); // Set loading to true when fetching starts
      try {
        const result = await getAllPositions(snaptradeUserId, userSecret);

        if (result && (result as any).error) {
          setError(new Error((result as any).error));
          setData(null);
        }
         else if (result) {
          setData(result as any[]);
          setError(null);
        }
        else {
          setData(null);
          setError(new Error("Failed to fetch positions: Empty response."));
        }
      }
      catch (err: any) {
        console.error('Error fetching SnapTrade positions:', err);
        setError(err);
        setData(null);
      }
      finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Re-run effect when snaptradeUserId or userSecret changes
  }, [snaptradeUserId, userSecret]);

  return { data, isLoading, error };
};

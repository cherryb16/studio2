'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';

interface PortfolioData {
  dashboard: {
    totalBalance: number;
    totalCash: number;
    totalEquities: number;
    totalOptions: number;
    totalUnrealizedPnL: number;
    totalRealizedPnL: number;
    totalReturnPercentage: number;
    buyingPower: number;
    lastUpdated: string;
  };
  quickStats: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    totalFees: number;
  };
  topPositions: Array<{
    symbol: string;
    description: string;
    value: number;
    unrealizedPnL: number;
    type: string;
  }>;
  composition: {
    cash: number;
    equities: number;
    options: number;
    crypto: number;
    other: number;
  };
  performance: {
    volatility: number;
    sharpeRatio: number;
    historicalData: Array<{
      month: string;
      portfolio: number;
      date: string;
    }>;
  };
  metadata: {
    lastSync: string;
    dataSource: string;
    version: string;
  };
  source: 'cache' | 'bigquery';
  cached: boolean;
}

export function useOptimizedPortfolio(accountId?: string) {
  const { user } = useAuth();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPortfolioData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        userId: user.uid,
        ...(accountId && { accountId })
      });

      const response = await fetch(`/api/portfolio/dashboard?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const portfolioData = await response.json();
      
      if ('error' in portfolioData) {
        throw new Error(portfolioData.error);
      }

      setData(portfolioData);
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    if (!user?.uid || isRefreshing) return;

    try {
      setIsRefreshing(true);
      
      const response = await fetch('/api/portfolio/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh data');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Refresh failed');
      }

      // Re-fetch the updated data
      await fetchPortfolioData();
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const checkDataFreshness = async () => {
    if (!user?.uid) return null;

    try {
      const response = await fetch(`/api/sync/status?userId=${user.uid}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Error checking data freshness:', err);
    }
    return null;
  };

  useEffect(() => {
    fetchPortfolioData();
  }, [user?.uid, accountId]);

  // Auto-refresh every 5 minutes if data is from BigQuery (not cached)
  useEffect(() => {
    if (!data?.cached) {
      const interval = setInterval(() => {
        fetchPortfolioData();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [data?.cached]);

  return {
    data,
    loading,
    error,
    isRefreshing,
    refetch: fetchPortfolioData,
    refreshData,
    checkDataFreshness,
    isFromCache: data?.cached || false
  };
}
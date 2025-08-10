// Fast Firestore-based hooks to replace slow API calls
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { 
  PositionService, 
  TradeService, 
  PortfolioService, 
  AnalyticsService 
} from '@/lib/firestore-service';
import { SnapTradeFirestoreSync } from '@/lib/snaptrade-firestore-sync';
import { 
  FirestorePosition, 
  FirestoreTrade, 
  FirestorePortfolioSummary,
  TradeStatsCache 
} from '@/lib/firestore-schema';

// ==================== PORTFOLIO HOOK ====================

export function usePortfolio() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FirestorePortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Real-time listener for portfolio summary
    const unsubscribe = PortfolioService.subscribeToPortfolioSummary(
      user.uid,
      (portfolioSummary) => {
        setSummary(portfolioSummary);
        setLoading(false);
        setError(null);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      // Trigger a sync (you'd need to get credentials from somewhere)
      // This would typically be called less frequently
      const summary = await PortfolioService.getPortfolioSummary(user.uid);
      setSummary(summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh portfolio');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  return {
    summary,
    loading,
    error,
    refresh
  };
}

// ==================== POSITIONS HOOK ====================

export function usePositions(options: { limit?: number; realTime?: boolean } = {}) {
  const { user } = useAuth();
  const [positions, setPositions] = useState<FirestorePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    if (options.realTime) {
      // Real-time listener
      const unsubscribe = PositionService.subscribeToUserPositions(
        user.uid,
        (userPositions) => {
          setPositions(userPositions);
          setLoading(false);
          setError(null);
        },
        { limit: options.limit }
      );

      return unsubscribe;
    } else {
      // One-time fetch
      PositionService.getUserPositions(user.uid, { limit: options.limit })
        .then((userPositions) => {
          setPositions(userPositions);
          setLoading(false);
          setError(null);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [user?.uid, options.limit, options.realTime]);

  return {
    positions,
    loading,
    error
  };
}

// ==================== TOP POSITIONS HOOK ====================

export function useTopPositions(limit = 10) {
  const { user } = useAuth();
  const [positions, setPositions] = useState<FirestorePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    PositionService.getTopPositions(user.uid, limit)
      .then((topPositions) => {
        setPositions(topPositions);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user?.uid, limit]);

  return {
    positions,
    loading,
    error
  };
}

// ==================== TRADES HOOK ====================

export function useTrades(options: { 
  limit?: number; 
  symbol?: string;
  days?: number;
} = {}) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<FirestoreTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchTrades = async () => {
      try {
        let result: FirestoreTrade[];
        
        if (options.days) {
          result = await TradeService.getRecentTrades(
            user.uid, 
            options.days, 
            options.limit || 100
          );
        } else {
          result = await TradeService.getUserTrades(user.uid, {
            symbol: options.symbol,
            limit: options.limit,
            userId: user.uid
          });
        }

        setTrades(result);
        setLoading(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trades');
        setLoading(false);
      }
    };

    fetchTrades();
  }, [user?.uid, options.limit, options.symbol, options.days]);

  return {
    trades,
    loading,
    error
  };
}

// ==================== TRADE STATS HOOK ====================

export function useTradeStats(period: 'day' | 'week' | 'month' | 'year' | 'all' = 'all') {
  const { user } = useAuth();
  const [stats, setStats] = useState<TradeStatsCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        let result = await AnalyticsService.getTradeStats(user.uid, period);
        
        // If no cached stats, calculate them
        if (!result) {
          result = await AnalyticsService.calculateAndCacheTradeStats(user.uid, period);
        }

        setStats(result);
        setLoading(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trade stats');
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.uid, period]);

  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const result = await AnalyticsService.calculateAndCacheTradeStats(user.uid, period);
      setStats(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh trade stats');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, period]);

  return {
    stats,
    loading,
    error,
    refresh
  };
}

// ==================== SYNC HOOK ====================

export function useDataSync() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async (credentials?: {
    snaptradeUserId: string;
    userSecret: string;
  }) => {
    if (!user?.uid || !credentials) return;

    setSyncing(true);
    setError(null);

    try {
      const result = await SnapTradeFirestoreSync.quickSync({
        userId: user.uid,
        ...credentials
      });

      if (result.success) {
        setLastSync(new Date());
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [user?.uid]);

  const fullSync = useCallback(async (credentials?: {
    snaptradeUserId: string;
    userSecret: string;
  }) => {
    if (!user?.uid || !credentials) return;

    setSyncing(true);
    setError(null);

    try {
      const result = await SnapTradeFirestoreSync.fullSync({
        userId: user.uid,
        ...credentials
      });

      if (result.success) {
        setLastSync(new Date());
      } else {
        setError(result.error || 'Full sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Full sync failed');
    } finally {
      setSyncing(false);
    }
  }, [user?.uid]);

  return {
    sync,
    fullSync,
    syncing,
    lastSync,
    error
  };
}

// ==================== ANALYTICS HOOK ====================

export function useAnalytics() {
  const { positions } = usePositions();
  const { stats: allTimeStats } = useTradeStats('all');
  const { stats: monthStats } = useTradeStats('month');

  // Derived analytics (calculated client-side for speed)
  const analytics = {
    totalPositions: positions.length,
    totalValue: positions.reduce((sum, p) => sum + p.marketValue, 0),
    totalUnrealizedPnL: positions.reduce((sum, p) => sum + p.unrealizedPnL, 0),
    topPositions: positions
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 10),
    
    // From cached trade stats
    allTime: allTimeStats,
    thisMonth: monthStats,
    
    // Position breakdown
    positionsByType: positions.reduce((acc, pos) => {
      acc[pos.instrumentType] = (acc[pos.instrumentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  return analytics;
}
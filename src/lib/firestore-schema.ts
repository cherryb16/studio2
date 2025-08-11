// Optimized Firestore schema for fast trading data queries
import { Timestamp } from 'firebase/firestore';

// ==================== CORE DATA TYPES ====================

export interface FirestorePosition {
  id: string;
  userId: string;
  symbol: string;
  accountId: string;
  
  // Position details
  units: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  
  // Classification
  instrumentType: 'stock' | 'option' | 'etf' | 'crypto';
  isOption: boolean;
  optionDetails?: {
    strike: number;
    expiration: string;
    type: 'call' | 'put';
  };
  
  // Metadata
  openedAt: Timestamp;
  updatedAt: Timestamp;
  status: 'open' | 'closed';
}

export interface FirestoreTrade {
  id: string;
  userId: string;
  accountId: string;
  positionId?: string; // Link to position
  
  // Trade details
  symbol: string;
  action: 'BUY' | 'SELL';
  units: number;
  price: number;
  totalValue: number;
  fee: number;
  
  // Classification
  instrumentType: 'stock' | 'option' | 'etf' | 'crypto';
  isOption: boolean;
  optionDetails?: {
    strike: number;
    expiration: string;
    type: 'call' | 'put';
  };
  
  // Performance (for closed trades)
  realizedPnL?: number;
  holdingPeriod?: number; // days
  
  // Metadata
  executedAt: Timestamp;
  tradeDate: string; // YYYY-MM-DD for easy querying
  currency: string;
  status: 'filled' | 'pending' | 'cancelled';
  updatedAt: Timestamp;
}

export interface FirestorePortfolioSummary {
  id: string; // userId
  userId: string;
  
  // Totals
  totalValue: number;
  totalCash: number;
  totalSecurities: number;
  dayChange: number;
  dayChangePercent: number;
  
  // Performance metrics (cached for speed)
  totalReturn: number;
  totalReturnPercent: number;
  realizedPnL: number;
  unrealizedPnL: number;
  
  // Trade stats (cached)
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  
  // Metadata
  lastSyncAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== COLLECTION STRUCTURE ====================
// Structure: snaptrade_users/{userId}/trades, snaptrade_users/{userId}/positions_options, snaptrade_users/{userId}/positions_equities, snaptrade_users/{userId}/metrics, snaptrade_users/{userId}/onboarding_information/{actual_information}, snaptrade_users/{userId}/information

export const COLLECTIONS = {
  // Main collection containing all SnapTrade users
  SNAPTRADE_USERS: 'snaptrade_users',
  
  // Subcollections under each user
  TRADES: 'trades',
  POSITIONS_OPTIONS: 'positions_options',
  POSITIONS_EQUITIES: 'positions_equities',
  METRICS: 'metrics',
  ONBOARDING_INFORMATION: 'onboarding_information',
  INFORMATION: 'information' // Kept for backward compatibility
} as const;

// Metrics types (combining portfolio_summaries and user_metrics)
export const METRICS_TYPES = {
  PORTFOLIO_SUMMARY: 'portfolio_summary',
  TRADE_STATS: 'trade_stats',
  PERFORMANCE: 'performance'
} as const;

// ==================== COMPOSITE INDEX REQUIREMENTS ====================
/*
Required Firestore composite indexes:

1. positions: userId ASC, status ASC, updatedAt DESC
2. positions: userId ASC, symbol ASC, updatedAt DESC  
3. positions: userId ASC, marketValue DESC
4. positions: userId ASC, unrealizedPnL DESC

5. trades: userId ASC, executedAt DESC
6. trades: userId ASC, tradeDate DESC
7. trades: userId ASC, symbol ASC, executedAt DESC
8. trades: userId ASC, status ASC, executedAt DESC
9. trades: userId ASC, realizedPnL DESC (for performance queries)

10. user_metrics: userId ASC, period ASC, updatedAt DESC
*/

// ==================== QUERY HELPERS ====================

export interface QueryFilters {
  userId: string;
  symbol?: string;
  period?: 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
  status?: string;
}

export interface TradeStatsCache {
  userId: string;
  period: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalRealizedPnL: number;
  updatedAt: Timestamp;
}
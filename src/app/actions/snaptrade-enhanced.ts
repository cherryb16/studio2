// src/app/actions/snaptrade-enhanced.ts
'use server';

import { 
  getPortfolioAnalytics as getPortfolioAnalyticsImpl,
  getPortfolioOverview as getPortfolioOverviewImpl,
  getPerformanceMetrics as getPerformanceMetricsImpl
} from './data-sources/snaptrade/analytics';

import { getTradeSummaryStats } from './snaptrade-trades';

// Wrapper functions for backwards compatibility in server actions
export async function getPortfolioAnalytics(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  return await getPortfolioAnalyticsImpl(snaptradeUserId, userSecret, accountId);
}

export async function getPortfolioOverview(
  snaptradeUserId: string,
  userSecret: string
) {
  return await getPortfolioOverviewImpl(snaptradeUserId, userSecret);
}

export async function getPerformanceMetrics(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  return await getPerformanceMetricsImpl(snaptradeUserId, userSecret, accountId);
}

export async function getRealizedGains(
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    // Get all-time trade statistics using the exact same call as trade journal
    console.log('Dashboard: Fetching all-time realized gains...');
    const stats = await getTradeSummaryStats(snaptradeUserId, userSecret, 'all');
    
    if ('error' in stats) {
      console.error('Dashboard: Error in getTradeSummaryStats:', stats.error);
      return { error: stats.error };
    }
    
    console.log('Dashboard: getTradeSummaryStats result:', {
      totalRealizedPnL: stats.totalRealizedPnL,
      totalTrades: stats.totalTrades,
      closedTrades: stats.closedTrades
    });
    
    return {
      totalRealizedPnL: stats.totalRealizedPnL,
      winningTrades: stats.winningTrades,
      losingTrades: stats.losingTrades,
      winRate: stats.winRate,
      totalTrades: stats.totalTrades,
      closedTrades: stats.closedTrades
    };
  } catch (error) {
    console.error('Error fetching realized gains:', error);
    return { error: 'Failed to fetch realized gains' };
  }
}
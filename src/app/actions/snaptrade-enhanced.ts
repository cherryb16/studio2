'use server';

import { snaptrade } from './snaptrade-client';
import {
  getSnapTradeCredentials,
  getSnapTradeAccounts,
  getSnapTradeBalances,
  getSnapTradePositions,
  getAllPositions,
  getUserHoldings
} from './snaptrade';
import {
  generatePortfolioSummary,
  calculateTotalBalance,
  calculateEquitiesBalance,
  calculateOptionsBalance,
  calculateCashBalance,
  calculateTotalUnrealizedPnL,
  getTopPositions
} from './portfolio-analytics';

// Helper to ensure account property is present
function normalizeHoldingsData(holdings: any, accountId?: string): any {
  return {
    ...holdings,
    account: holdings.account ?? (accountId ? { id: accountId } : {})
  };
}

// PATCHED USAGES BELOW

export async function getPortfolioAnalytics(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    const holdings = await getUserHoldings(snaptradeUserId, userSecret, accountId);
    if ('error' in holdings) {
      return holdings;
    }
    // PATCH: always pass account property
    return generatePortfolioSummary(normalizeHoldingsData(holdings, accountId));
  } catch (error) {
    console.error('Error getting portfolio analytics:', error);
    return { error: 'Failed to get portfolio analytics.' };
  }
}

export async function getPortfolioOverview(
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    const accountsResponse = await getSnapTradeAccounts(snaptradeUserId, userSecret);
    if ('error' in accountsResponse) {
      return accountsResponse;
    }
    let totalBalance = 0;
    let totalCash = 0;
    let totalEquities = 0;
    let totalOptions = 0;
    let totalUnrealizedPnL = 0;
    const accountSummaries = [];
    for (const account of accountsResponse) {
      const holdings = await getUserHoldings(snaptradeUserId, userSecret, account.id);
      if (!('error' in holdings)) {
        const normalizedHoldings = normalizeHoldingsData(holdings, account.id); // PATCH
        const accountBalance = calculateTotalBalance(normalizedHoldings);
        const accountCash = calculateCashBalance(normalizedHoldings);
        const accountEquities = calculateEquitiesBalance(normalizedHoldings);
        const accountOptions = calculateOptionsBalance(normalizedHoldings);
        const accountPnL = calculateTotalUnrealizedPnL(normalizedHoldings);
        totalBalance += accountBalance;
        totalCash += accountCash;
        totalEquities += accountEquities;
        totalOptions += accountOptions;
        totalUnrealizedPnL += accountPnL;
        accountSummaries.push({
          accountId: account.id,
          accountName: account.name,
          balance: accountBalance,
          cash: accountCash,
          equities: accountEquities,
          options: accountOptions,
          unrealizedPnL: accountPnL
        });
      }
    }
    return {
      totalBalance,
      totalCash,
      totalEquities,
      totalOptions,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercentage: totalBalance > 0 ? (totalUnrealizedPnL / (totalBalance - totalUnrealizedPnL)) * 100 : 0,
      accountCount: accountsResponse.length,
      accounts: accountSummaries
    };
  } catch (error) {
    console.error('Error getting portfolio overview:', error);
    return { error: 'Failed to get portfolio overview.' };
  }
}

export async function getAccountComparison(
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    const accountsResponse = await getSnapTradeAccounts(snaptradeUserId, userSecret);
    if ('error' in accountsResponse) {
      return accountsResponse;
    }
    const accountComparisons = [];
    for (const account of accountsResponse) {
      const holdings = await getUserHoldings(snaptradeUserId, userSecret, account.id);
      if (!('error' in holdings)) {
        const normalizedHoldings = normalizeHoldingsData(holdings, account.id); // PATCH
        const analytics = generatePortfolioSummary(normalizedHoldings);
        accountComparisons.push({
          accountId: account.id,
          accountName: account.name,
          institutionName: account.institution_name,
          accountType: account.meta?.type || account.raw_type,
          totalBalance: analytics.totalBalance,
          composition: analytics.composition,
          unrealizedPnL: analytics.unrealizedPnL.total,
          unrealizedPnLPercentage: analytics.unrealizedPnL.totalPercentage,
          topPosition: analytics.topPositions[0] || null,
          positionCount: analytics.diversification.totalPositions,
          lastSync: account.sync_status?.holdings?.last_successful_sync
        });
      }
    }
    return accountComparisons;
  } catch (error) {
    console.error('Error getting account comparison:', error);
    return { error: 'Failed to get account comparison.' };
  }
}

// ==================== WATCHLIST SUGGESTIONS ====================

export async function getWatchlistCandidates(
  snaptradeUserId: string, 
  userSecret: string,
  limit: number = 10
) {
  try {
    const analytics = await getPortfolioAnalytics(snaptradeUserId, userSecret);
    
    if ('error' in analytics) {
      return analytics;
    }

    const topPositions = getTopPositions(analytics as any, 20);
    const sectors = new Set();
    
    // This would typically require additional market data API
    return {
      suggestedSymbols: [],
      basedOnSectors: Array.from(sectors),
      relatedToCurrentHoldings: topPositions.slice(0, 5).map(pos => pos.symbol)
    };
  } catch (error) {
    console.error('Error getting watchlist candidates:', error);
    return { error: 'Failed to get watchlist candidates.' };
  }
}

// ==================== PERFORMANCE METRICS ====================

export async function getPerformanceMetrics(
  snaptradeUserId: string, 
  userSecret: string,
  timeframe: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'
) {
  try {
    const currentAnalytics = await getPortfolioAnalytics(snaptradeUserId, userSecret);
    
    if ('error' in currentAnalytics) {
      return currentAnalytics;
    }

    // This would typically require historical data
    return {
      currentValue: (currentAnalytics as any).totalBalance,
      timeframe,
      totalReturn: 0, // Placeholder
      totalReturnPercentage: 0, // Placeholder
      volatility: 0, // Placeholder
      sharpeRatio: 0, // Placeholder
      maxDrawdown: 0, // Placeholder
      bestDay: { date: null, return: 0 },
      worstDay: { date: null, return: 0 },
      unrealizedPnL: (currentAnalytics as any).unrealizedPnL.total,
      unrealizedPnLPercentage: (currentAnalytics as any).unrealizedPnL.totalPercentage
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return { error: 'Failed to get performance metrics.' };
  }
}

// ==================== REBALANCING SUGGESTIONS ====================

export async function getRebalancingSuggestions(
  snaptradeUserId: string, 
  userSecret: string,
  targetAllocation?: { [key: string]: number }
) {
  try {
    const analytics = await getPortfolioAnalytics(snaptradeUserId, userSecret);
    
    if ('error' in analytics) {
      return analytics;
    }

    const currentComposition = (analytics as any).composition;
    const defaultTarget = {
      equities: 60,
      cash: 10,
      options: 5,
      crypto: 5,
      other: 20
    };

    const target = targetAllocation || defaultTarget;
    const suggestions = [];

    for (const [assetClass, targetPercent] of Object.entries(target)) {
      const currentPercent = currentComposition[assetClass] || 0;
      const difference = targetPercent - currentPercent;
      
      if (Math.abs(difference) > 5) {
        suggestions.push({
          assetClass,
          currentPercent: Math.round(currentPercent * 100) / 100,
          targetPercent,
          difference: Math.round(difference * 100) / 100,
          action: difference > 0 ? 'increase' : 'decrease',
          priority: Math.abs(difference) > 15 ? 'high' : 'medium'
        });
      }
    }

    return {
      needsRebalancing: suggestions.length > 0,
      suggestions: suggestions.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
      currentComposition,
      targetComposition: target
    };
  } catch (error) {
    console.error('Error getting rebalancing suggestions:', error);
    return { error: 'Failed to get rebalancing suggestions.' };
  }
}
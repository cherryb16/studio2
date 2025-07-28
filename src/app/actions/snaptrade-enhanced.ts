// src/app/actions/snaptrade-enhanced.ts
'use server';

import { snaptrade } from './snaptrade'; // Import your existing snaptrade instance
import { 
  generatePortfolioSummary,
  calculateTotalBalance,
  calculateEquitiesBalance,
  calculateOptionsBalance,
  calculateCashBalance,
  calculateTotalUnrealizedPnL,
  getTopPositions
} from './portfolio-analytics';

// ==================== ENHANCED SNAPTRADE FUNCTIONS ====================

/**
 * Get comprehensive portfolio analytics for a user
 */
export async function getPortfolioAnalytics(
  snaptradeUserId: string, 
  userSecret: string, 
  accountId?: string
) {
  try {
    if (accountId) {
      // Get analytics for a specific account
      const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: accountId,
      });

      if ((holdingsResponse.data as any)?.error) {
        return { error: (holdingsResponse.data as any).error };
      }

      return generatePortfolioSummary(holdingsResponse.data);
    } else {
      // Get analytics for all accounts combined
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });

      if ((accountsResponse.data as any)?.error) {
        return { error: (accountsResponse.data as any).error };
      }

      // Aggregate holdings from all accounts
      const allHoldings = {
        account: null,
        balances: [] as any[],
        positions: [] as any[],
        option_positions: [] as any[],
        orders: [] as any[],
        total_value: { value: 0, currency: 'USD' }
      };

      let totalValue = 0;

      for (const account of accountsResponse.data) {
        const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
          userId: snaptradeUserId,
          userSecret: userSecret,
          accountId: account.id,
        });

        if (holdingsResponse.data && !(holdingsResponse.data as any)?.error) {
          const holdings = holdingsResponse.data;
          
          allHoldings.balances = allHoldings.balances.concat(holdings.balances || []);
          allHoldings.positions = allHoldings.positions.concat(holdings.positions || []);
          allHoldings.option_positions = allHoldings.option_positions.concat(holdings.option_positions || []);
          allHoldings.orders = allHoldings.orders.concat(holdings.orders || []);
          
          totalValue += holdings.total_value?.value || 0;
        }
      }

      allHoldings.total_value.value = totalValue;
      return generatePortfolioSummary(allHoldings);
    }
  } catch (error) {
    console.error(`Error getting portfolio analytics${accountId ? ` for account ${accountId}` : ''}:`, error);
    return { error: `Failed to get portfolio analytics${accountId ? ` for account ${accountId}` : ''}.` };
  }
}

/**
 * Get simplified portfolio overview (faster, less detailed)
 */
export async function getPortfolioOverview(
  snaptradeUserId: string, 
  userSecret: string
) {
  try {
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    if ((accountsResponse.data as any)?.error) {
      return { error: (accountsResponse.data as any).error };
    }

    let totalBalance = 0;
    let totalCash = 0;
    let totalEquities = 0;
    let totalOptions = 0;
    let totalUnrealizedPnL = 0;
    const accountSummaries = [];

    for (const account of accountsResponse.data) {
      const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: account.id,
      });

      if (holdingsResponse.data && !(holdingsResponse.data as any)?.error) {
        const holdings = holdingsResponse.data;
        
        const accountBalance = calculateTotalBalance(holdings);
        const accountCash = calculateCashBalance(holdings);
        const accountEquities = calculateEquitiesBalance(holdings);
        const accountOptions = calculateOptionsBalance(holdings);
        const accountPnL = calculateTotalUnrealizedPnL(holdings);

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
      accountCount: accountsResponse.data.length,
      accounts: accountSummaries
    };
  } catch (error) {
    console.error('Error getting portfolio overview:', error);
    return { error: 'Failed to get portfolio overview.' };
  }
}

/**
 * Get account comparison data
 */
export async function getAccountComparison(
  snaptradeUserId: string, 
  userSecret: string
) {
  try {
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    if ((accountsResponse.data as any)?.error) {
      return { error: (accountsResponse.data as any).error };
    }

    const accountComparisons = [];

    for (const account of accountsResponse.data) {
      const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: account.id,
      });

      if (holdingsResponse.data && !(holdingsResponse.data as any)?.error) {
        const holdings = holdingsResponse.data;
        const analytics = generatePortfolioSummary(holdings);

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

/**
 * Get watchlist candidates based on current holdings
 */
export async function getWatchlistCandidates(
  snaptradeUserId: string, 
  userSecret: string,
  limit: number = 10
) {
  try {
    const analytics = await getPortfolioAnalytics(snaptradeUserId, userSecret);
    
    if ((analytics as any).error) {
      return analytics;
    }

    // Get sectors/industries from current top positions
    const topPositions = getTopPositions(analytics as any, 20);
    const sectors = new Set();
    
    // This would typically require additional market data API
    // For now, return structure for watchlist candidates
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

/**
 * Calculate portfolio performance metrics over time
 * Note: This would require historical data from SnapTrade or external source
 */
export async function getPerformanceMetrics(
  snaptradeUserId: string, 
  userSecret: string,
  timeframe: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'
) {
  try {
    // This would typically require historical portfolio values
    // For now, return current snapshot with placeholder for historical data
    const currentAnalytics = await getPortfolioAnalytics(snaptradeUserId, userSecret);
    
    if ((currentAnalytics as any).error) {
      return currentAnalytics;
    }

    return {
      currentValue: (currentAnalytics as any).totalBalance,
      timeframe,
      // These would be calculated from historical data:
      totalReturn: 0, // Placeholder
      totalReturnPercentage: 0, // Placeholder
      volatility: 0, // Placeholder
      sharpeRatio: 0, // Placeholder
      maxDrawdown: 0, // Placeholder
      bestDay: { date: null, return: 0 },
      worstDay: { date: null, return: 0 },
      // Current unrealized PnL as proxy for recent performance
      unrealizedPnL: (currentAnalytics as any).unrealizedPnL.total,
      unrealizedPnLPercentage: (currentAnalytics as any).unrealizedPnL.totalPercentage
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return { error: 'Failed to get performance metrics.' };
  }
}

/**
 * Get portfolio rebalancing suggestions
 */
export async function getRebalancingSuggestions(
  snaptradeUserId: string, 
  userSecret: string,
  targetAllocation?: { [key: string]: number }
) {
  try {
    const analytics = await getPortfolioAnalytics(snaptradeUserId, userSecret);
    
    if ((analytics as any).error) {
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
      
      if (Math.abs(difference) > 5) { // Only suggest if >5% difference
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
// src/app/actions/snaptrade-trades-enhanced.ts
'use server';

// Enhanced trade types based on SnapTrade activities
export interface SnapTradeActivity {
  id: string;
  account_id: string;
  symbol?: string;
  instrument?: {
    id: string;
    symbol: string;
    raw_symbol: string;
    description?: string;
    currency?: {
      id: string;
      code: string;
      name: string;
    };
    exchange?: {
      id: string;
      code: string;
      name: string;
    };
    type?: {
      id: string;
      code: string;
      description: string;
    };
  };
  option_symbol?: {
    id: string;
    ticker: string;
    option_type: 'CALL' | 'PUT';
    strike_price: number;
    expiration_date: string;
    underlying_symbol: {
      id: string;
      symbol: string;
      raw_symbol: string;
      description?: string;
    };
  };
  type: 'BUY' | 'SELL' | 'OPTIONEXPIRATION' | 'OPTIONASSIGNMENT' | 'OPTIONEXERCISE' | 
        'DIVIDEND' | 'CONTRIBUTION' | 'WITHDRAWAL' | 'REI' | 'STOCK_DIVIDEND' | 
        'INTEREST' | 'FEE' | 'TRANSFER';
  description?: string;
  quantity?: number;
  price?: number;
  commission?: number;
  currency?: {
    id: string;
    code: string;
    name: string;
  };
  settlement_date?: string;
  trade_date?: string;
  executed_at?: string;
  created_at?: string;
}

export interface EnhancedTradeActivity {
  id: string;
  accountId: string;
  symbol: string;
  instrument: string;
  type: 'BUY' | 'SELL' | 'OPTIONEXPIRATION' | 'OPTIONASSIGNMENT' | 'OPTIONEXERCISE';
  action: 'BUY' | 'SELL' | 'EXPIRE' | 'ASSIGN' | 'EXERCISE';
  quantity: number;
  price: number;
  totalValue: number;
  commission: number;
  currency: string;
  executedAt: Date;
  tradeDate: string;
  settlementDate?: string;
  isOption: boolean;
  optionDetails?: {
    underlying: string;
    strike: number;
    expiration: string;
    type: 'CALL' | 'PUT';
  };
  // For P&L calculations when we have pairs
  entryPrice?: number;
  exitPrice?: number;
  realizedPnL?: number;
  holdingPeriod?: number;
  status?: 'open' | 'closed' | 'expired' | 'assigned' | 'exercised';
}

export interface AnalyticsActivity {
  id: string;
  accountId: string;
  type: 'DIVIDEND' | 'CONTRIBUTION' | 'WITHDRAWAL' | 'REI' | 'STOCK_DIVIDEND' | 'INTEREST' | 'FEE' | 'TRANSFER';
  description: string;
  amount: number;
  currency: string;
  symbol?: string;
  instrument?: string;
  executedAt: Date;
  tradeDate: string;
  settlementDate?: string;
}

// Get all activities from the Cloudflare Worker
async function getActivitiesFromWorker(
  snaptradeUserId: string,
  userSecret: string,
  accountId: string,
  startDate?: Date,
  endDate?: Date,
  type?: 'trades' | 'analytics'
): Promise<SnapTradeActivity[] | { error: string }> {
  const workerUrl = process.env.SNAPTRADE_WORKER_URL;
  if (!workerUrl) {
    return { error: 'SnapTrade Worker URL not configured' };
  }

  try {
    const params = new URLSearchParams({
      accountId,
    });
    
    if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
    if (type) params.append('type', type);

    const response = await fetch(`${workerUrl}/activities?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': snaptradeUserId,
        'X-User-Secret': userSecret,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || `Request failed with status ${response.status}` };
    }

    const activities = await response.json();
    return Array.isArray(activities) ? activities : [];
  } catch (error) {
    console.error('Error fetching activities from worker:', error);
    return { error: 'Failed to fetch activities from worker' };
  }
}

// Convert SnapTrade activity to enhanced trade
function convertToEnhancedTrade(activity: SnapTradeActivity): EnhancedTradeActivity {
  const isOption = !!activity.option_symbol;
  const symbol = activity.instrument?.symbol || activity.symbol || 'UNKNOWN';
  
  let action: EnhancedTradeActivity['action'];
  switch (activity.type) {
    case 'BUY':
      action = 'BUY';
      break;
    case 'SELL':
      action = 'SELL';
      break;
    case 'OPTIONEXPIRATION':
      action = 'EXPIRE';
      break;
    case 'OPTIONASSIGNMENT':
      action = 'ASSIGN';
      break;
    case 'OPTIONEXERCISE':
      action = 'EXERCISE';
      break;
    default:
      action = 'BUY'; // fallback
  }

  const enhancedTrade: EnhancedTradeActivity = {
    id: activity.id,
    accountId: activity.account_id,
    symbol,
    instrument: activity.instrument?.description || symbol,
    type: activity.type as EnhancedTradeActivity['type'],
    action,
    quantity: Math.abs(activity.quantity || 0),
    price: activity.price || 0,
    totalValue: Math.abs((activity.quantity || 0) * (activity.price || 0)),
    commission: activity.commission || 0,
    currency: activity.currency?.code || activity.instrument?.currency?.code || 'USD',
    executedAt: new Date(activity.executed_at || activity.created_at || new Date()),
    tradeDate: activity.trade_date || activity.executed_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    settlementDate: activity.settlement_date,
    isOption,
    status: 'open', // Default status, will be updated during P&L calculation
  };

  if (isOption && activity.option_symbol) {
    enhancedTrade.optionDetails = {
      underlying: activity.option_symbol.underlying_symbol.symbol,
      strike: activity.option_symbol.strike_price,
      expiration: activity.option_symbol.expiration_date,
      type: activity.option_symbol.option_type,
    };
    // Update instrument description for options
    enhancedTrade.instrument = `${activity.option_symbol.underlying_symbol.symbol} ${activity.option_symbol.strike_price} ${activity.option_symbol.option_type} ${activity.option_symbol.expiration_date}`;
  }

  return enhancedTrade;
}

// Convert SnapTrade activity to analytics activity
function convertToAnalyticsActivity(activity: SnapTradeActivity): AnalyticsActivity {
  return {
    id: activity.id,
    accountId: activity.account_id,
    type: activity.type as AnalyticsActivity['type'],
    description: activity.description || `${activity.type} transaction`,
    amount: Math.abs((activity.quantity || 0) * (activity.price || 0)) || 0,
    currency: activity.currency?.code || activity.instrument?.currency?.code || 'USD',
    symbol: activity.instrument?.symbol || activity.symbol,
    instrument: activity.instrument?.description,
    executedAt: new Date(activity.executed_at || activity.created_at || new Date()),
    tradeDate: activity.trade_date || activity.executed_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    settlementDate: activity.settlement_date,
  };
}

// Get enhanced trade activities (BUY, SELL, OPTION*)
export async function getEnhancedTradeActivities(
  snaptradeUserId: string,
  userSecret: string,
  startDate?: Date,
  endDate?: Date,
  accountId?: string
): Promise<EnhancedTradeActivity[] | { error: string }> {
  try {
    // Get all accounts if no specific account ID is provided
    let accountIds: string[] = [];
    
    if (accountId) {
      accountIds = [accountId];
    } else {
      const workerUrl = process.env.SNAPTRADE_WORKER_URL;
      if (!workerUrl) {
        return { error: 'SnapTrade Worker URL not configured' };
      }

      const accountsResponse = await fetch(`${workerUrl}/accounts`, {
        headers: {
          'X-User-ID': snaptradeUserId,
          'X-User-Secret': userSecret,
        },
      });

      if (!accountsResponse.ok) {
        return { error: 'Failed to fetch accounts' };
      }

      const accounts = await accountsResponse.json();
      accountIds = accounts.map((acc: any) => acc.id);
    }

    const allActivities: EnhancedTradeActivity[] = [];

    // Fetch activities for each account
    for (const accId of accountIds) {
      const activitiesResult = await getActivitiesFromWorker(
        snaptradeUserId,
        userSecret,
        accId,
        startDate,
        endDate,
        'trades' // Only get trade-related activities
      );

      if ('error' in activitiesResult) {
        console.error(`Error fetching activities for account ${accId}:`, activitiesResult.error);
        continue; // Skip this account but continue with others
      }

      const enhancedTrades = activitiesResult.map(convertToEnhancedTrade);
      allActivities.push(...enhancedTrades);
    }

    // Sort by execution date, most recent first
    allActivities.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());

    // Calculate P&L for matched positions (simplified FIFO matching)
    const processedTrades = calculateTradesPnL(allActivities);

    return processedTrades;
  } catch (error) {
    console.error('Error getting enhanced trade activities:', error);
    return { error: 'Failed to get enhanced trade activities.' };
  }
}

// Get analytics activities (DIVIDEND, CONTRIBUTION, etc.)
export async function getAnalyticsActivities(
  snaptradeUserId: string,
  userSecret: string,
  startDate?: Date,
  endDate?: Date,
  accountId?: string
): Promise<AnalyticsActivity[] | { error: string }> {
  try {
    // Get all accounts if no specific account ID is provided
    let accountIds: string[] = [];
    
    if (accountId) {
      accountIds = [accountId];
    } else {
      const workerUrl = process.env.SNAPTRADE_WORKER_URL;
      if (!workerUrl) {
        return { error: 'SnapTrade Worker URL not configured' };
      }

      const accountsResponse = await fetch(`${workerUrl}/accounts`, {
        headers: {
          'X-User-ID': snaptradeUserId,
          'X-User-Secret': userSecret,
        },
      });

      if (!accountsResponse.ok) {
        return { error: 'Failed to fetch accounts' };
      }

      const accounts = await accountsResponse.json();
      accountIds = accounts.map((acc: any) => acc.id);
    }

    const allActivities: AnalyticsActivity[] = [];

    // Fetch activities for each account
    for (const accId of accountIds) {
      const activitiesResult = await getActivitiesFromWorker(
        snaptradeUserId,
        userSecret,
        accId,
        startDate,
        endDate,
        'analytics' // Only get analytics-related activities
      );

      if ('error' in activitiesResult) {
        console.error(`Error fetching activities for account ${accId}:`, activitiesResult.error);
        continue; // Skip this account but continue with others
      }

      const analyticsActivities = activitiesResult.map(convertToAnalyticsActivity);
      allActivities.push(...analyticsActivities);
    }

    // Sort by execution date, most recent first
    allActivities.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());

    return allActivities;
  } catch (error) {
    console.error('Error getting analytics activities:', error);
    return { error: 'Failed to get analytics activities.' };
  }
}

// Simple FIFO P&L calculation for matched positions
function calculateTradesPnL(trades: EnhancedTradeActivity[]): EnhancedTradeActivity[] {
  const openPositions = new Map<string, { trade: EnhancedTradeActivity; remainingQuantity: number }[]>();
  const processedTrades = [...trades];

  // Sort by execution date, oldest first for FIFO matching
  const sortedTrades = [...trades].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());

  for (let i = 0; i < processedTrades.length; i++) {
    const trade = processedTrades[i];
    const originalTrade = sortedTrades.find(t => t.id === trade.id);
    if (!originalTrade) continue;

    const positionKey = trade.isOption 
      ? `${trade.symbol}_${trade.optionDetails?.strike}_${trade.optionDetails?.type}_${trade.optionDetails?.expiration}`
      : trade.symbol;

    if (originalTrade.action === 'BUY') {
      // Opening position
      if (!openPositions.has(positionKey)) {
        openPositions.set(positionKey, []);
      }
      openPositions.get(positionKey)!.push({
        trade: originalTrade,
        remainingQuantity: originalTrade.quantity,
      });
    } else if (originalTrade.action === 'SELL') {
      // Potentially closing position
      const openForSymbol = openPositions.get(positionKey) || [];
      
      if (openForSymbol.length > 0) {
        let remainingQuantity = originalTrade.quantity;
        const closedPositions: Array<{ entry: EnhancedTradeActivity; quantity: number }> = [];

        // FIFO matching
        while (remainingQuantity > 0 && openForSymbol.length > 0) {
          const openPos = openForSymbol[0];
          const quantityToClose = Math.min(remainingQuantity, openPos.remainingQuantity);
          
          closedPositions.push({
            entry: openPos.trade,
            quantity: quantityToClose,
          });

          openPos.remainingQuantity -= quantityToClose;
          remainingQuantity -= quantityToClose;

          if (openPos.remainingQuantity === 0) {
            openForSymbol.shift();
          }
        }

        // Calculate realized P&L if we have matching positions
        if (closedPositions.length > 0) {
          let totalCostBasis = 0;
          let totalQuantity = 0;
          let firstEntryDate: Date | null = null;

          for (const closed of closedPositions) {
            const multiplier = trade.isOption ? 100 : 1; // Options have 100 share multiplier
            totalCostBasis += closed.entry.price * closed.quantity * multiplier;
            totalQuantity += closed.quantity;
            
            if (!firstEntryDate || closed.entry.executedAt < firstEntryDate) {
              firstEntryDate = closed.entry.executedAt;
            }
          }

          const avgEntryPrice = totalQuantity > 0 ? totalCostBasis / (totalQuantity * (trade.isOption ? 100 : 1)) : 0;
          const multiplier = trade.isOption ? 100 : 1;
          const realizedPnL = (originalTrade.price - avgEntryPrice) * totalQuantity * multiplier - originalTrade.commission;
          
          // Update the trade with P&L information
          trade.entryPrice = avgEntryPrice;
          trade.exitPrice = originalTrade.price;
          trade.realizedPnL = realizedPnL;
          trade.status = 'closed';
          
          if (firstEntryDate) {
            const holdingPeriod = Math.floor((originalTrade.executedAt.getTime() - firstEntryDate.getTime()) / (1000 * 60 * 60 * 24));
            trade.holdingPeriod = holdingPeriod;
          }
        }
      }
    } else if (['EXPIRE', 'ASSIGN', 'EXERCISE'].includes(originalTrade.action)) {
      // Option-specific actions
      trade.status = originalTrade.action.toLowerCase() as any;
    }
  }

  return processedTrades;
}

// Get trade summary statistics
export async function getTradesSummaryStats(
  snaptradeUserId: string,
  userSecret: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'month'
) {
  try {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(2000, 0, 1); // Far enough back
        break;
    }

    const trades = await getEnhancedTradeActivities(
      snaptradeUserId,
      userSecret,
      startDate,
      endDate
    );

    if ('error' in trades) {
      return trades;
    }

    const stats = {
      totalTrades: trades.length,
      buyTrades: trades.filter(t => t.action === 'BUY').length,
      sellTrades: trades.filter(t => t.action === 'SELL').length,
      optionTrades: trades.filter(t => t.isOption).length,
      closedTrades: trades.filter(t => t.status === 'closed').length,
      winningTrades: trades.filter(t => t.realizedPnL && t.realizedPnL > 0).length,
      losingTrades: trades.filter(t => t.realizedPnL && t.realizedPnL < 0).length,
      totalRealizedPnL: 0,
      totalCommissions: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      largestWin: { trade: null as EnhancedTradeActivity | null, amount: 0 },
      largestLoss: { trade: null as EnhancedTradeActivity | null, amount: 0 },
      mostTradedSymbols: new Map<string, number>(),
      tradesByDay: new Map<string, number>(),
      tradesByType: {
        stocks: trades.filter(t => !t.isOption).length,
        options: trades.filter(t => t.isOption).length,
        optionExpired: trades.filter(t => t.action === 'EXPIRE').length,
        optionAssigned: trades.filter(t => t.action === 'ASSIGN').length,
        optionExercised: trades.filter(t => t.action === 'EXERCISE').length,
      }
    };

    let totalWins = 0;
    let totalLosses = 0;

    for (const trade of trades) {
      stats.totalCommissions += trade.commission;
      
      // Count trades by symbol
      const count = stats.mostTradedSymbols.get(trade.symbol) || 0;
      stats.mostTradedSymbols.set(trade.symbol, count + 1);
      
      // Count trades by day
      const dayKey = trade.tradeDate;
      const dayCount = stats.tradesByDay.get(dayKey) || 0;
      stats.tradesByDay.set(dayKey, dayCount + 1);
      
      if (trade.realizedPnL !== undefined) {
        stats.totalRealizedPnL += trade.realizedPnL;
        
        if (trade.realizedPnL > 0) {
          totalWins += trade.realizedPnL;
          if (trade.realizedPnL > stats.largestWin.amount) {
            stats.largestWin = { trade, amount: trade.realizedPnL };
          }
        } else if (trade.realizedPnL < 0) {
          totalLosses += Math.abs(trade.realizedPnL);
          if (Math.abs(trade.realizedPnL) > Math.abs(stats.largestLoss.amount)) {
            stats.largestLoss = { trade, amount: trade.realizedPnL };
          }
        }
      }
    }

    // Calculate derived stats
    if (stats.closedTrades > 0) {
      stats.winRate = (stats.winningTrades / stats.closedTrades) * 100;
    }
    
    if (stats.winningTrades > 0) {
      stats.avgWin = totalWins / stats.winningTrades;
    }
    
    if (stats.losingTrades > 0) {
      stats.avgLoss = totalLosses / stats.losingTrades;
    }
    
    if (totalLosses > 0) {
      stats.profitFactor = totalWins / totalLosses;
    }

    return stats;
  } catch (error) {
    console.error('Error getting trade summary stats:', error);
    return { error: 'Failed to get trade summary stats.' };
  }
}

// Get analytics summary statistics
export async function getAnalyticsSummaryStats(
  snaptradeUserId: string,
  userSecret: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'month'
) {
  try {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(2000, 0, 1);
        break;
    }

    const activities = await getAnalyticsActivities(
      snaptradeUserId,
      userSecret,
      startDate,
      endDate
    );

    if ('error' in activities) {
      return activities;
    }

    const stats = {
      totalActivities: activities.length,
      totalDividends: 0,
      totalContributions: 0,
      totalWithdrawals: 0,
      totalInterest: 0,
      totalFees: 0,
      dividendActivities: activities.filter(a => a.type === 'DIVIDEND').length,
      contributionActivities: activities.filter(a => a.type === 'CONTRIBUTION').length,
      withdrawalActivities: activities.filter(a => a.type === 'WITHDRAWAL').length,
      interestActivities: activities.filter(a => a.type === 'INTEREST').length,
      feeActivities: activities.filter(a => a.type === 'FEE').length,
      transferActivities: activities.filter(a => a.type === 'TRANSFER').length,
      reiActivities: activities.filter(a => a.type === 'REI').length,
      stockDividendActivities: activities.filter(a => a.type === 'STOCK_DIVIDEND').length,
      activitiesByDay: new Map<string, number>(),
      topDividendPayers: new Map<string, number>(),
    };

    for (const activity of activities) {
      // Count activities by day
      const dayKey = activity.tradeDate;
      const dayCount = stats.activitiesByDay.get(dayKey) || 0;
      stats.activitiesByDay.set(dayKey, dayCount + 1);

      // Sum amounts by type
      switch (activity.type) {
        case 'DIVIDEND':
          stats.totalDividends += activity.amount;
          if (activity.symbol) {
            const currentAmount = stats.topDividendPayers.get(activity.symbol) || 0;
            stats.topDividendPayers.set(activity.symbol, currentAmount + activity.amount);
          }
          break;
        case 'CONTRIBUTION':
          stats.totalContributions += activity.amount;
          break;
        case 'WITHDRAWAL':
          stats.totalWithdrawals += activity.amount;
          break;
        case 'INTEREST':
          stats.totalInterest += activity.amount;
          break;
        case 'FEE':
          stats.totalFees += activity.amount;
          break;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error getting analytics summary stats:', error);
    return { error: 'Failed to get analytics summary stats.' };
  }
}
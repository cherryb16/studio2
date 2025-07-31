// src/app/actions/snaptrade-trades.ts
'use server';

import { snaptrade } from './snaptrade-client';

export interface SnapTradeTrade {
  id: string;
  account_id: string;
  symbol: string;
  universal_symbol_id: string;
  option_symbol?: string;
  action: 'BUY' | 'SELL';
  units: number;
  price: number;
  currency: string;
  exchange: string;
  executed_at: string;
  trade_date: string;
  settlement_date: string;
  fee: number;
  fx_rate: number;
  institution_trade_id?: string;
}

export interface EnhancedTrade {
  id: string;
  accountId: string;
  symbol: string;
  instrument: string;
  action: 'BUY' | 'SELL';
  position: 'long' | 'short' | 'close';
  units: number;
  price: number;
  totalValue: number;
  fee: number;
  currency: string;
  executedAt: Date;
  tradeDate: string;
  isOption: boolean;
  optionDetails?: {
    underlying: string;
    strike: number;
    expiration: string;
    type: 'CALL' | 'PUT';
  };
  // For closed positions
  entryPrice?: number;
  exitPrice?: number;
  realizedPnL?: number;
  holdingPeriod?: number;
  status?: 'open' | 'closed' | 'partial';
}

// Get all activities (trades) for a user
export async function getSnapTradeTrades(
  snaptradeUserId: string,
  userSecret: string,
  startDate?: Date,
  endDate?: Date,
  accountId?: string
) {
  try {
    // Get all accounts if not specified
    let accountIds: string[] = [];
    
    if (accountId) {
      accountIds = [accountId];
    } else {
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
      accountIds = accountsResponse.data.map(acc => acc.id);
    }

    const allTrades: SnapTradeTrade[] = [];

    // Fetch activities for each account
    for (const accId of accountIds) {
      try {
        const activitiesResponse = await snaptrade.transactionsAndReporting.getActivities({
          userId: snaptradeUserId,
          userSecret: userSecret,
          accounts: accId,
          startDate: startDate?.toISOString().split('T')[0],
          endDate: endDate?.toISOString().split('T')[0],
          type: 'TRADE', // Only get trade activities
        });

        if (activitiesResponse.data && Array.isArray(activitiesResponse.data)) {
          allTrades.push(...activitiesResponse.data as SnapTradeTrade[]);
        }
      } catch (error) {
        console.error(`Error fetching trades for account ${accId}:`, error);
      }
    }

    // Sort by execution date, most recent first
    allTrades.sort((a, b) => 
      new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
    );

    return allTrades;
  } catch (error) {
    console.error('Error fetching SnapTrade trades:', error);
    return { error: 'Failed to fetch trades.' };
  }
}

// Get enhanced trade data with position matching
export async function getEnhancedTrades(
  snaptradeUserId: string,
  userSecret: string,
  startDate?: Date,
  endDate?: Date,
  accountId?: string
): Promise<EnhancedTrade[] | { error: string }> {
  try {
    const trades = await getSnapTradeTrades(
      snaptradeUserId,
      userSecret,
      startDate,
      endDate,
      accountId
    );

    if ('error' in trades) {
      return trades;
    }

    // Group trades by symbol to match opens with closes
    const tradesBySymbol = new Map<string, SnapTradeTrade[]>();
    
    for (const trade of trades) {
      const symbol = trade.option_symbol || trade.symbol;
      if (!tradesBySymbol.has(symbol)) {
        tradesBySymbol.set(symbol, []);
      }
      tradesBySymbol.get(symbol)!.push(trade);
    }

    const enhancedTrades: EnhancedTrade[] = [];
    const openPositions = new Map<string, { trade: SnapTradeTrade; remainingUnits: number }[]>();

    // Process trades for each symbol
    for (const [symbol, symbolTrades] of tradesBySymbol) {
      // Sort by date, oldest first for FIFO matching
      const sortedTrades = [...symbolTrades].sort((a, b) => 
        new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
      );

      for (const trade of sortedTrades) {
        const isOption = !!trade.option_symbol;
        const instrument = isOption ? parseOptionSymbol(trade.option_symbol!) : trade.symbol;
        
        const baseTrade: EnhancedTrade = {
          id: trade.id,
          accountId: trade.account_id,
          symbol: trade.symbol,
          instrument,
          action: trade.action,
          position: trade.action === 'BUY' ? 'long' : 'short',
          units: trade.units,
          price: trade.price,
          totalValue: trade.units * trade.price,
          fee: trade.fee,
          currency: trade.currency,
          executedAt: new Date(trade.executed_at),
          tradeDate: trade.trade_date,
          isOption,
          status: 'open',
        };

        if (isOption && trade.option_symbol) {
          baseTrade.optionDetails = parseOptionDetails(trade.option_symbol);
        }

        // Match with open positions for P&L calculation
        const openForSymbol = openPositions.get(symbol) || [];
        
        if (trade.action === 'SELL' && openForSymbol.length > 0) {
          // This is a closing trade
          let remainingUnits = trade.units;
          const closedPositions: Array<{ entry: SnapTradeTrade; units: number }> = [];

          // FIFO matching
          while (remainingUnits > 0 && openForSymbol.length > 0) {
            const openPos = openForSymbol[0];
            const unitsToClose = Math.min(remainingUnits, openPos.remainingUnits);
            
            closedPositions.push({
              entry: openPos.trade,
              units: unitsToClose,
            });

            openPos.remainingUnits -= unitsToClose;
            remainingUnits -= unitsToClose;

            if (openPos.remainingUnits === 0) {
              openForSymbol.shift();
            }
          }

          // Calculate realized P&L
          let totalCostBasis = 0;
          let totalUnits = 0;

          for (const closed of closedPositions) {
            totalCostBasis += closed.entry.price * closed.units;
            totalUnits += closed.units;
          }

          const avgEntryPrice = totalUnits > 0 ? totalCostBasis / totalUnits : 0;
          const realizedPnL = (trade.price - avgEntryPrice) * totalUnits;
          
          baseTrade.position = 'close';
          baseTrade.entryPrice = avgEntryPrice;
          baseTrade.exitPrice = trade.price;
          baseTrade.realizedPnL = realizedPnL;
          baseTrade.status = 'closed';
          
          if (closedPositions.length > 0) {
            const firstEntry = new Date(closedPositions[0].entry.executed_at);
            const exit = new Date(trade.executed_at);
            baseTrade.holdingPeriod = Math.floor((exit.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24));
          }
        } else if (trade.action === 'BUY') {
          // This is an opening trade
          if (!openPositions.has(symbol)) {
            openPositions.set(symbol, []);
          }
          openPositions.get(symbol)!.push({
            trade,
            remainingUnits: trade.units,
          });
        }

        enhancedTrades.push(baseTrade);
      }
    }

    // Sort by execution date, most recent first
    enhancedTrades.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());

    return enhancedTrades;
  } catch (error) {
    console.error('Error getting enhanced trades:', error);
    return { error: 'Failed to get enhanced trades.' };
  }
}

// Parse option symbol to get details
function parseOptionDetails(optionSymbol: string): EnhancedTrade['optionDetails'] {
  // Option symbols typically follow format: AAPL230120C00150000
  // Where: AAPL is underlying, 230120 is date (YYMMDD), C is call/put, 00150000 is strike * 1000
  
  const match = optionSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  
  if (match) {
    const [, underlying, dateStr, type, strikeStr] = match;
    const year = parseInt('20' + dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    const strike = parseInt(strikeStr) / 1000;
    
    return {
      underlying,
      strike,
      expiration: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      type: type as 'CALL' | 'PUT',
    };
  }
  
  // Fallback for non-standard format
  return {
    underlying: optionSymbol.substring(0, 4),
    strike: 0,
    expiration: 'Unknown',
    type: 'CALL',
  };
}

function parseOptionSymbol(optionSymbol: string): string {
  const details = parseOptionDetails(optionSymbol);
  if (!details) return optionSymbol;

  return `${details.underlying} ${details.strike} ${details.type} ${details.expiration}`;
}

// Get trade summary statistics
export async function getTradeSummaryStats(
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

    const trades = await getEnhancedTrades(
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
      closedTrades: trades.filter(t => t.status === 'closed').length,
      winningTrades: trades.filter(t => t.realizedPnL && t.realizedPnL > 0).length,
      losingTrades: trades.filter(t => t.realizedPnL && t.realizedPnL < 0).length,
      totalRealizedPnL: 0,
      totalFees: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      largestWin: { trade: null as EnhancedTrade | null, amount: 0 },
      largestLoss: { trade: null as EnhancedTrade | null, amount: 0 },
      mostTradedSymbols: new Map<string, number>(),
      tradesByDay: new Map<string, number>(),
    };

    let totalWins = 0;
    let totalLosses = 0;

    for (const trade of trades) {
      stats.totalFees += trade.fee;
      
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
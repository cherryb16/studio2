// src/app/actions/snaptrade-trades.ts
'use server';

import { snaptrade } from './snaptrade-client';

export interface SnapTradeTrade {
  id: string;
  account?: {
    id: string;
    name?: string;
  };
  symbol?: {
    symbol?: string;
    description?: string;
  };
  option_symbol?: {
    underlying_symbol?: {
      symbol?: string;
    };
    option_type?: string;
    strike_price?: number;
    expiration_date?: string;
  };
  type: string; // BUY, SELL, etc
  units?: number;
  quantity?: number;
  price?: number;
  amount?: number;
  currency?: {
    code: string;
  };
  trade_date?: string;
  settlement_date?: string;
  fee?: number;
  fx_rate?: number;
  description?: string;
  institution?: string;
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
  status?: 'open' | 'closed' | 'partial' | 'expired' | 'assigned' | 'exercised';
}

// Get all activities (trades) for a user
export async function getSnapTradeTrades(
  snaptradeUserId: string,
  userSecret: string,
  startDate?: Date,
  endDate?: Date,
  accountId?: string
) {
  console.log('=== Starting getSnapTradeTrades ===');
  console.log('Input parameters:', {
    snaptradeUserId,
    userSecret: userSecret ? `${userSecret.substring(0, 8)}...` : 'undefined',
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    accountId
  });

  try {
    // Get all accounts if not specified
    let accountIds: string[] = [];
    
    if (accountId) {
      accountIds = [accountId];
      console.log('Using specific account ID:', accountId);
    } else {
      console.log('Fetching all user accounts...');
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
      console.log('Accounts response:', accountsResponse);
      console.log('Accounts data:', accountsResponse.data);
      
      if (accountsResponse.data && Array.isArray(accountsResponse.data)) {
        accountIds = accountsResponse.data.map(acc => acc.id);
        console.log('Extracted account IDs:', accountIds);
      } else {
        console.error('No accounts found or invalid response format');
        return { error: 'No accounts found' };
      }
    }

    if (accountIds.length === 0) {
      console.error('No account IDs available');
      return { error: 'No account IDs available' };
    }

    const allTrades: SnapTradeTrade[] = [];

    // Try multiple approaches to fetch activities
    const attempts = [
      {
        name: 'All activities without type filter',
        params: {
          userId: snaptradeUserId,
          userSecret: userSecret,
          accounts: accountIds.join(','),
          startDate: startDate?.toISOString().split('T')[0],
          endDate: endDate?.toISOString().split('T')[0],
        }
      },
      {
        name: 'Trade and option activities',
        params: {
          userId: snaptradeUserId,
          userSecret: userSecret,
          accounts: accountIds.join(','),
          startDate: startDate?.toISOString().split('T')[0],
          endDate: endDate?.toISOString().split('T')[0],
          type: 'BUY,SELL,OPTIONEXPIRATION,OPTIONASSIGNMENT,OPTIONEXERCISE',
        }
      },
      {
        name: 'No date filter',
        params: {
          userId: snaptradeUserId,
          userSecret: userSecret,
          accounts: accountIds.join(','),
        }
      }
    ];

    for (const attempt of attempts) {
      try {
        console.log(`=== Attempting: ${attempt.name} ===`);
        console.log('Request parameters:', {
          ...attempt.params,
          userSecret: userSecret ? `${userSecret.substring(0, 8)}...` : 'undefined'
        });
        
        const activitiesResponse = await snaptrade.transactionsAndReporting.getActivities(attempt.params);

        console.log('=== Activities API Response ===');
        console.log('Response status:', activitiesResponse.status);
        console.log('Response headers:', activitiesResponse.headers);
        console.log('Response data type:', typeof activitiesResponse.data);
        console.log('Response data length:', Array.isArray(activitiesResponse.data) ? activitiesResponse.data.length : 'not array');
        
        if (activitiesResponse.data && Array.isArray(activitiesResponse.data) && activitiesResponse.data.length > 0) {
          console.log(`✅ SUCCESS: Found ${activitiesResponse.data.length} activities with ${attempt.name}`);
          console.log('First activity sample:', JSON.stringify(activitiesResponse.data[0], null, 2));
          console.log('Sample activity fields:', Object.keys(activitiesResponse.data[0]));
          
          // Filter for trade types if we got all activities
          const tradeActivities = attempt.name.includes('All activities') 
            ? activitiesResponse.data.filter((activity: any) => 
                ['BUY', 'SELL', 'OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE'].includes(activity.type)
              )
            : activitiesResponse.data;
            
          console.log(`Filtered to ${tradeActivities.length} trade activities`);
          allTrades.push(...tradeActivities as SnapTradeTrade[]);
          break; // Success, exit the loop
        } else {
          console.log(`❌ ${attempt.name} returned empty or invalid data:`, activitiesResponse.data);
        }
      } catch (attemptError) {
        console.error(`❌ Error with ${attempt.name}:`, attemptError);
        continue; // Try next approach
      }
    }

    if (allTrades.length === 0) {
      console.warn('=== No activities found after all attempts ===');
      console.log('This could mean:');
      console.log('1. No trading activity in the specified date range');
      console.log('2. Account has no trade history');
      console.log('3. API credentials may not have access to trade data');
      console.log('4. SnapTrade API may be returning data in a different format');
      
      // Don't return an error if we simply have no trades - this is valid
      return [];
    }

    console.log('=== Final processing ===');
    console.log(`Total trades collected: ${allTrades.length}`);

    // Sort by trade date, most recent first
    allTrades.sort((a, b) => 
      new Date(b.trade_date || '').getTime() - new Date(a.trade_date || '').getTime()
    );

    console.log('Returning trades:', allTrades.length > 0 ? 'SUCCESS' : 'EMPTY');
    console.log('=== End getSnapTradeTrades ===');

    return allTrades;
  } catch (error) {
    console.error('=== Outer catch block error ===');
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
  console.log('=== Starting getEnhancedTrades ===');
  console.log('Enhanced trades input parameters:', {
    snaptradeUserId,
    userSecret: userSecret ? `${userSecret.substring(0, 8)}...` : 'undefined',
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    accountId
  });

  try {
    console.log('Calling getSnapTradeTrades...');
    const trades = await getSnapTradeTrades(
      snaptradeUserId,
      userSecret,
      startDate,
      endDate,
      accountId
    );

    console.log('getSnapTradeTrades result:', { 
      isError: 'error' in trades, 
      tradeCount: Array.isArray(trades) ? trades.length : 0,
      trades: Array.isArray(trades) ? trades : 'ERROR'
    });

    if ('error' in trades) {
      console.error('Error from getSnapTradeTrades:', trades.error);
      return trades;
    }

    // Group trades by unique identifier to match opens with closes
    const tradesByIdentifier = new Map<string, SnapTradeTrade[]>();
    
    for (const trade of trades) {
      const isOption = !!trade.option_symbol;
      let identifier: string;
      
      if (isOption && trade.option_symbol) {
        // For options, use symbol + strike + expiration + type to create unique identifier
        const underlying = trade.option_symbol.underlying_symbol?.symbol || 'UNKNOWN';
        const strike = trade.option_symbol.strike_price || 0;
        const expiration = trade.option_symbol.expiration_date || '';
        const optionType = trade.option_symbol.option_type || 'CALL';
        identifier = `${underlying}_${strike}_${expiration}_${optionType}`;
      } else {
        // For stocks, just use the symbol
        identifier = trade.symbol?.symbol || 'UNKNOWN';
      }
      
      if (!tradesByIdentifier.has(identifier)) {
        tradesByIdentifier.set(identifier, []);
      }
      tradesByIdentifier.get(identifier)!.push(trade);
    }

    const enhancedTrades: EnhancedTrade[] = [];
    const openPositions = new Map<string, { trade: SnapTradeTrade; remainingUnits: number; enhancedTrade: EnhancedTrade }[]>();

    // Process trades for each identifier
    for (const [identifier, identifierTrades] of tradesByIdentifier) {
      // Sort by date, oldest first for FIFO matching
      const sortedTrades = [...identifierTrades].sort((a, b) => 
        new Date(a.trade_date || '').getTime() - new Date(b.trade_date || '').getTime()
      );

      for (const trade of sortedTrades) {
        const isOption = !!trade.option_symbol;
        const symbol = trade.option_symbol?.underlying_symbol?.symbol || trade.symbol?.symbol || 'UNKNOWN';
        const instrument = isOption ? parseOptionSymbol(trade.option_symbol!) : symbol;
        
        // Map action and status based on trade type
        let action: 'BUY' | 'SELL';
        let position: 'long' | 'short' | 'close';
        let status: 'open' | 'closed' | 'partial' | 'expired' | 'assigned' | 'exercised' = 'open';

        switch (trade.type) {
          case 'BUY':
            action = 'BUY';
            position = 'long';
            break;
          case 'SELL':
            action = 'SELL';
            position = 'short';
            break;
          case 'OPTIONEXPIRATION':
            action = 'SELL'; // Treat as a closing action
            position = 'close';
            status = 'expired';
            break;
          case 'OPTIONASSIGNMENT':
            action = 'SELL'; // Treat as a closing action
            position = 'close';
            status = 'assigned';
            break;
          case 'OPTIONEXERCISE':
            action = 'BUY'; // Treat as a closing action
            position = 'close';
            status = 'exercised';
            break;
          default:
            action = 'BUY';
            position = 'long';
        }

        const baseTrade: EnhancedTrade = {
          id: trade.id,
          accountId: trade.account?.id || '',
          symbol: symbol,
          instrument,
          action,
          position,
          units: Math.abs(trade.units || trade.quantity || 0),
          price: trade.price || 0,
          totalValue: Math.abs(trade.units || trade.quantity || 0) * (trade.price || 0),
          fee: trade.fee || 0,
          currency: trade.currency?.code || 'USD',
          executedAt: new Date(trade.trade_date || ''),
          tradeDate: trade.trade_date || '',
          isOption,
          status,
        };

        if (isOption && trade.option_symbol) {
          baseTrade.optionDetails = parseOptionDetails(trade.option_symbol);
        }

        // Match with open positions for P&L calculation
        const openForIdentifier = openPositions.get(identifier) || [];
        
        console.log(`Processing ${trade.type} for ${identifier}:`, {
          tradeId: trade.id,
          symbol,
          units: trade.units || trade.quantity,
          price: trade.price,
          openPositions: openForIdentifier.length
        });
        
        if (['SELL', 'OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE'].includes(trade.type) && openForIdentifier.length > 0) {
          // This is a closing trade
          let remainingUnits = Math.abs(trade.units || trade.quantity || 0);
          const closedPositions: Array<{ entry: SnapTradeTrade; units: number }> = [];

          // FIFO matching
          while (remainingUnits > 0 && openForIdentifier.length > 0) {
            const openPos = openForIdentifier[0];
            const unitsToClose = Math.min(remainingUnits, openPos.remainingUnits);
            
            closedPositions.push({
              entry: openPos.trade,
              units: unitsToClose,
            });

            openPos.remainingUnits -= unitsToClose;
            remainingUnits -= unitsToClose;

            // Update the enhanced trade status based on remaining units
            if (openPos.remainingUnits === 0) {
              // Fully closed - mark as closed
              openPos.enhancedTrade.status = 'closed';
              openPos.enhancedTrade.position = 'close';
              openForIdentifier.shift();
            } else {
              // Partially closed - mark as partial
              openPos.enhancedTrade.status = 'partial';
            }
          }

          // Calculate realized P&L
          console.log(`Calculating P&L for ${identifier}, closed ${closedPositions.length} positions`);
          let totalCostBasis = 0;
          let totalUnits = 0;
          let totalEntryFees = 0;

          for (const closed of closedPositions) {
            const multiplier = isOption ? 100 : 1; // Options represent 100 shares
            totalCostBasis += (closed.entry.price || 0) * closed.units * multiplier;
            totalUnits += closed.units;
            totalEntryFees += (closed.entry.fee || 0) * (closed.units / (closed.entry.units || closed.entry.quantity || 1));
          }

          const avgEntryPrice = totalUnits > 0 ? totalCostBasis / (totalUnits * (isOption ? 100 : 1)) : 0;
          const multiplier = isOption ? 100 : 1;
          const grossPnL = ((trade.price || 0) - avgEntryPrice) * totalUnits * multiplier;
          const realizedPnL = grossPnL - totalEntryFees - (trade.fee || 0);
          
          console.log(`P&L Results for ${identifier}:`, {
            avgEntryPrice,
            exitPrice: trade.price,
            totalUnits,
            multiplier,
            grossPnL,
            totalEntryFees,
            exitFee: trade.fee,
            realizedPnL
          });
          
          baseTrade.position = 'close';
          baseTrade.entryPrice = avgEntryPrice;
          baseTrade.exitPrice = trade.price || 0;
          baseTrade.realizedPnL = realizedPnL;
          baseTrade.status = 'closed';
          
          if (closedPositions.length > 0) {
            const firstEntry = new Date(closedPositions[0].entry.trade_date || '');
            const exit = new Date(trade.trade_date || '');
            baseTrade.holdingPeriod = Math.floor((exit.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24));
          }
        } else if (trade.type === 'BUY') {
          // This is an opening trade
          console.log(`Adding BUY position for ${identifier}:`, {
            tradeId: trade.id,
            units: trade.units || trade.quantity,
            price: trade.price,
            date: trade.trade_date
          });
          
          if (!openPositions.has(identifier)) {
            openPositions.set(identifier, []);
          }
          openPositions.get(identifier)!.push({
            trade,
            remainingUnits: Math.abs(trade.units || trade.quantity || 0),
            enhancedTrade: baseTrade,
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
function parseOptionDetails(optionSymbol: any): EnhancedTrade['optionDetails'] {
  // If the option symbol is already parsed by SnapTrade
  if (typeof optionSymbol === 'object' && optionSymbol.underlying_symbol) {
    return {
      underlying: optionSymbol.underlying_symbol.symbol || 'UNKNOWN',
      strike: optionSymbol.strike_price || 0,
      expiration: optionSymbol.expiration_date || 'Unknown',
      type: optionSymbol.option_type as 'CALL' | 'PUT' || 'CALL',
    };
  }
  
  // If it's a string, try to parse it
  if (typeof optionSymbol === 'string') {
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
  
  // Default fallback
  return {
    underlying: 'UNKNOWN',
    strike: 0,
    expiration: 'Unknown',
    type: 'CALL',
  };
}

function parseOptionSymbol(optionSymbol: any): string {
  const details = parseOptionDetails(optionSymbol);
  if (!details) return 'Unknown Option';

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
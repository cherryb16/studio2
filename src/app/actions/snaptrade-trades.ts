// src/app/actions/snaptrade-trades.ts
'use server';

import { snaptrade } from './snaptrade-client';
import { format } from 'date-fns';

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

  try {
    // Get all accounts if not specified
    let accountIds: string[] = [];
    
    if (accountId) {
      accountIds = [accountId];
      console.log('Using specific account ID:', accountId);
    } else {
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
      // Accounts response logged (verbose logging removed)
      
      if (accountsResponse.data && Array.isArray(accountsResponse.data)) {
        accountIds = accountsResponse.data.map(acc => acc.id);
        // Extracted account IDs (verbose logging removed)
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
    const processedDates = new Set<string>(); // Track which dates we've processed to avoid duplicates

    // Paginated fetch with multiple requests to get all trades
    const fetchTradesWithPagination = async (currentEndDate?: Date): Promise<boolean> => {
      const dateStr = currentEndDate ? format(currentEndDate, 'yyyy-MM-dd') : undefined;
      if (dateStr && processedDates.has(dateStr)) {
        console.log(`Skipping already processed date: ${dateStr}`);
        return false;
      }
      const attempts = [
        {
          name: 'All activities without type filter',
          params: {
            userId: snaptradeUserId,
            userSecret: userSecret,
            accounts: accountIds.join(','),
            startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
            endDate: dateStr || (endDate ? format(endDate, 'yyyy-MM-dd') : undefined),
          }
        },
        {
          name: 'Trade and option activities',
          params: {
            userId: snaptradeUserId,
            userSecret: userSecret,
            accounts: accountIds.join(','),
            startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
            endDate: dateStr || (endDate ? format(endDate, 'yyyy-MM-dd') : undefined),
            type: 'BUY,SELL,OPTIONEXPIRATION,OPTIONASSIGNMENT,OPTIONEXERCISE',
          }
        },
        {
          name: 'No date filter',
          params: {
            userId: snaptradeUserId,
            userSecret: userSecret,
            accounts: accountIds.join(','),
            ...(dateStr && { endDate: dateStr })
          }
        }
      ];

      for (const attempt of attempts) {
        try {
          const activitiesResponse = await snaptrade.transactionsAndReporting.getActivities(attempt.params);
          
          if (activitiesResponse.data && Array.isArray(activitiesResponse.data) && activitiesResponse.data.length > 0) {
            
            // Filter for trade types if we got all activities
            const tradeActivities = attempt.name.includes('All activities') 
              ? activitiesResponse.data.filter((activity: any) => 
                  ['BUY', 'SELL', 'OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE'].includes(activity.type)
                )
              : activitiesResponse.data;
              

            // Deduplicate trades based on ID
            const existingTradeIds = new Set(allTrades.map(t => t.id));
            for (const trade of tradeActivities) {
              if (trade.id && !existingTradeIds.has(trade.id)) {
                allTrades.push(trade as SnapTradeTrade);
              }
            }
            
            if (dateStr) {
              processedDates.add(dateStr);
            }
            
            // Return true if we got the maximum (1000) trades, indicating more pages might exist
            return activitiesResponse.data.length === 1000;
          }
        } catch (attemptError) {
          console.error(`❌ Error with ${attempt.name}:`, attemptError);
          continue; // Try next approach
        }
      }
      
      return false; // No successful request found
    };

    // Initial fetch
    let hasMorePages = await fetchTradesWithPagination();
    let pageCount = 1;
    
    // Continue fetching until we get all trades (no artificial limit)
    while (hasMorePages) {
      pageCount++;
      
      // Sort current trades to get the oldest date for next pagination
      allTrades.sort((a, b) => {
        const aDate = format(new Date(a.trade_date || ''), 'yyyy-MM-dd');
        const bDate = format(new Date(b.trade_date || ''), 'yyyy-MM-dd');
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
      
      if (allTrades.length === 0) break;
      
      // Get the oldest trade date from current results, removing time component
      const oldestTrade = allTrades[allTrades.length - 1];
      const oldestTradeDate = new Date(format(new Date(oldestTrade.trade_date || ''), 'yyyy-MM-dd'));
      
      // Subtract 1 day to avoid getting the same last transaction
      const nextEndDate = new Date(oldestTradeDate);
      nextEndDate.setDate(nextEndDate.getDate() - 1);
      
      // Check if we've gone past our start date filter
      if (startDate && nextEndDate < startDate) {
        break;
      }
      
      hasMorePages = await fetchTradesWithPagination(nextEndDate);
      
      // Add a small delay between pages to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Fetched ${pageCount} pages, ${allTrades.length} total trades`);

    if (allTrades.length === 0) {
      console.warn('No trading activities found');
      return [];
    }

    // Sort by trade date, most recent first
    allTrades.sort((a, b) => {
      const aDate = format(new Date(a.trade_date || ''), 'yyyy-MM-dd');
      const bDate = format(new Date(b.trade_date || ''), 'yyyy-MM-dd');
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

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

  try {
    const trades = await getSnapTradeTrades(
      snaptradeUserId,
      userSecret,
      startDate,
      endDate,
      accountId
    );


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
        
        // Process trade for P&L matching
        
        if (['SELL', 'OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE'].includes(trade.type)) {
          // For SELL trades (including option expiration), check if we have open positions to close
          if (openForIdentifier.length > 0) {
            // This is a closing trade - we have open positions to match against
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
            
            // For short positions (like sold options), the P&L is reversed:
            // We received premium initially (avgEntryPrice), and we "buy back" at trade.price
            // If avgEntryPrice > 0 and we're closing at 0 (expiration), that's profitable
            const isShortPosition = closedPositions.some(cp => cp.entry.type === 'SELL');
            let grossPnL: number;
            
            if (isShortPosition) {
              // For short positions: profit = premium received - cost to close
              grossPnL = (avgEntryPrice - (trade.price || 0)) * totalUnits * multiplier;
            } else {
              // For long positions: profit = exit price - entry price
              grossPnL = ((trade.price || 0) - avgEntryPrice) * totalUnits * multiplier;
            }
            
            const realizedPnL = grossPnL - totalEntryFees - (trade.fee || 0);
            
            // P&L calculated
            
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
          } else {
            // This is a SELL trade with no open positions - it's a short opening or option writing
            if (isOption) {
              // For options SELL without open position, we're opening a short position (writing/selling options)
              baseTrade.position = 'short';
              baseTrade.status = 'open';
              
              // Add to open positions for future matching (expiration, assignment, etc.)
              if (!openPositions.has(identifier)) {
                openPositions.set(identifier, []);
              }
              openPositions.get(identifier)!.push({
                trade,
                remainingUnits: Math.abs(trade.units || trade.quantity || 0),
                enhancedTrade: baseTrade,
              });
            } else {
              // Regular SELL without open position - treat as short position
              baseTrade.position = 'short';
              baseTrade.status = 'open';
              
              if (!openPositions.has(identifier)) {
                openPositions.set(identifier, []);
              }
              openPositions.get(identifier)!.push({
                trade,
                remainingUnits: Math.abs(trade.units || trade.quantity || 0),
                enhancedTrade: baseTrade,
              });
            }
          }
        } else if (trade.type === 'BUY') {
          // This is an opening trade
          
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
        startDate = undefined; // No start date for all-time stats
        break;
    }

    const allTrades = await getEnhancedTrades(
      snaptradeUserId,
      userSecret,
      startDate,
      undefined // Don't limit end date for broader queries
    );

    if ('error' in allTrades) {
      return allTrades;
    }

    // Create a map to group trades by symbol
    const tradesBySymbol = new Map<string, EnhancedTrade[]>();
    for (const trade of allTrades) {
      const key = trade.isOption ? 
        `${trade.symbol}_${trade.optionDetails?.strike}_${trade.optionDetails?.expiration}_${trade.optionDetails?.type}` : 
        trade.symbol;
      
      if (!tradesBySymbol.has(key)) {
        tradesBySymbol.set(key, []);
      }
      tradesBySymbol.get(key)!.push(trade);
    }
    
    // Count completed positions and their outcomes
    let closedPositions = 0;
    let winningPositions = 0;
    let losingPositions = 0;
    
    for (const [, trades] of tradesBySymbol) {
      // Sort trades by date
      trades.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
      
      // Find completed positions (where all buys are matched with sells)
      let buyUnits = 0;
      let sellUnits = 0;
      let totalPnL = 0;
      
      for (const trade of trades) {
        if (trade.action === 'BUY') {
          buyUnits += trade.units;
        } else if (trade.action === 'SELL' || trade.status === 'expired') {
          sellUnits += trade.units;
          if (trade.realizedPnL) {
            totalPnL += trade.realizedPnL;
          }
        }
      }
      
      // If units match up, it's a completed position
      if (buyUnits > 0 && buyUnits === sellUnits) {
        closedPositions++;
        if (totalPnL > 0) {
          winningPositions++;
        } else if (totalPnL < 0) {
          losingPositions++;
        }
      }
    }

    const stats = {
      totalTrades: allTrades.length,
      closedTrades: closedPositions,
      winningTrades: winningPositions,
      losingTrades: losingPositions,
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

    for (const trade of allTrades) {
      stats.totalFees += trade.fee;
      
      // Count trades by symbol
      const count = stats.mostTradedSymbols.get(trade.symbol) || 0;
      stats.mostTradedSymbols.set(trade.symbol, count + 1);
      
      // Count trades by day
      const dayKey = trade.tradeDate;
      const dayCount = stats.tradesByDay.get(dayKey) || 0;
      stats.tradesByDay.set(dayKey, dayCount + 1);
      
      if (trade.realizedPnL !== undefined) {
        // Round realizedPnL to 2 decimal places
        const roundedPnL = Math.round(trade.realizedPnL * 100) / 100;
        stats.totalRealizedPnL += roundedPnL;
        
        if (roundedPnL > 0) {
          totalWins += roundedPnL;
          if (roundedPnL > stats.largestWin.amount) {
            stats.largestWin = { trade, amount: roundedPnL };
          }
        } else if (roundedPnL < 0) {
          totalLosses += Math.abs(roundedPnL);
          if (Math.abs(roundedPnL) > Math.abs(stats.largestLoss.amount)) {
            stats.largestLoss = { trade, amount: roundedPnL };
          }
        }
      }
    }

    // Round totalRealizedPnL to 2 decimal places
    stats.totalRealizedPnL = Math.round(stats.totalRealizedPnL * 100) / 100;

    // Calculate derived stats
    if (stats.closedTrades > 0) {
      // Round win rate to 1 decimal place
      stats.winRate = Math.round((stats.winningTrades / stats.closedTrades) * 1000) / 10;
    }
    
    if (stats.winningTrades > 0) {
      stats.avgWin = Math.round((totalWins / stats.winningTrades) * 100) / 100;
    }
    
    if (stats.losingTrades > 0) {
      stats.avgLoss = Math.round((totalLosses / stats.losingTrades) * 100) / 100;
    }
    
    if (totalLosses > 0) {
      stats.profitFactor = Math.round((totalWins / totalLosses) * 100) / 100;
    }

    return stats;
  } catch (error) {
    console.error('Error getting trade summary stats:', error);
    return { error: 'Failed to get trade summary stats.' };
  }
}
'use server';

import { insertData, upsertData, runQuery } from './client';
import { getSnapTradeTrades, getEnhancedTrades, getTradeSummaryStats } from '../snaptrade-trades';
import { getUserHoldings } from '../data-sources/snaptrade/positions';
import { getPerformanceMetrics } from '../data-sources/snaptrade/analytics';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

// Safe JSON stringify that handles circular references and removes functions
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      // Remove functions and undefined values
      if (typeof value === 'function' || value === undefined) {
        return null;
      }
      // Handle BigQuery Big number objects
      if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Big') {
        return parseFloat(value.toString());
      }
      return value;
    });
  } catch (error) {
    // Fallback for circular references
    return JSON.stringify({
      error: 'Failed to serialize object',
      type: typeof obj,
      keys: obj && typeof obj === 'object' ? Object.keys(obj) : []
    });
  }
}

// Helper function to safely convert numbers for BigQuery NUMERIC fields
function safeNumeric(value: any): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }
  // Round to 6 decimal places to avoid BigQuery precision issues
  return Math.round(num * 1000000) / 1000000;
}

// Load raw trades data from SnapTrade into BigQuery
export async function loadTradesData(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    
    const trades = await getEnhancedTrades(snaptradeUserId, userSecret, startDate, endDate, accountId);
    
    if ('error' in trades) {
      throw new Error(trades.error);
    }
    

    const tradesData = trades.map(trade => {
      // Ensure required fields are never null/undefined
      const tradeData = {
        trade_id: trade.id || `${snaptradeUserId}_${Date.now()}_${Math.random()}`,
        account_id: trade.accountId || 'default',
        user_id: snaptradeUserId,
        symbol: trade.symbol || 'UNKNOWN',
        instrument: trade.instrument || trade.symbol || 'UNKNOWN',
        action: trade.action || 'BUY',
        units: safeNumeric(trade.units),
        price: safeNumeric(trade.price),
        total_value: safeNumeric(trade.totalValue),
        fee: safeNumeric(trade.fee),
        currency: trade.currency || 'USD',
        trade_date: format(trade.executedAt, 'yyyy-MM-dd'),
        settlement_date: null,
        executed_at: trade.executedAt.toISOString(),
        is_option: trade.isOption || false,
        option_underlying: trade.optionDetails?.underlying || null,
        option_type: trade.optionDetails?.type || null,
        option_strike: trade.optionDetails?.strike ? safeNumeric(trade.optionDetails.strike) : null,
        option_expiration: trade.optionDetails?.expiration || null,
        entry_price: trade.entryPrice ? safeNumeric(trade.entryPrice) : null,
        exit_price: trade.exitPrice ? safeNumeric(trade.exitPrice) : null,
        realized_pnl: trade.realizedPnL ? safeNumeric(trade.realizedPnL) : null,
        holding_period: trade.holdingPeriod || null,
        trade_status: trade.status || 'open',
        raw_snaptrade_data: safeStringify(trade),
        data_source: 'snaptrade',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      return tradeData;
    });

    
    await upsertData('raw_trades', tradesData, ['trade_id']);
    return tradesData.length;
  } catch (error) {
    console.error('Error loading trades data:', error);
    throw error;
  }
}

// Load holdings snapshot into BigQuery
export async function loadHoldingsSnapshot(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    
    const holdings = await getUserHoldings(snaptradeUserId, userSecret, accountId);
    
    if ('error' in holdings) {
      throw new Error(holdings.error);
    }

    // Ensure all required fields are present and valid
    const snapshotData = {
      snapshot_id: uuidv4(),
      user_id: snaptradeUserId || 'unknown',
      account_id: accountId || 'all_accounts',
      snapshot_date: format(new Date(), 'yyyy-MM-dd'),
      snapshot_timestamp: new Date().toISOString(),
      total_balance: safeNumeric(holdings.total_value?.value),
      cash_balance: safeNumeric(holdings.balances?.reduce((sum, b) => sum + (b.cash || 0), 0)),
      buying_power: safeNumeric(holdings.balances?.reduce((sum, b) => sum + (b.buying_power || 0), 0)),
      positions: safeStringify(holdings.positions || []),
      option_positions: safeStringify(holdings.option_positions || []),
      total_unrealized_pnl: safeNumeric(holdings.positions?.reduce((sum, p) => sum + (p.open_pnl || 0), 0)),
      equities_balance: 0,
      options_balance: 0,
      crypto_balance: 0,
      other_balance: 0,
      raw_holdings_data: safeStringify(holdings),
      created_at: new Date().toISOString()
    };

    await insertData('holdings_snapshots', [snapshotData]);
    return 1;
  } catch (error) {
    console.error('Error loading holdings snapshot:', error);
    throw error;
  }
}

// Load portfolio analytics into BigQuery
export async function loadPortfolioAnalytics(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    
    const performance = await getPerformanceMetrics(snaptradeUserId, userSecret, accountId);
    const tradeStats = await getTradeSummaryStats(snaptradeUserId, userSecret, 'all');
    
    if ('error' in performance) {
      throw new Error(performance.error);
    }
    
    if ('error' in tradeStats) {
      throw new Error(tradeStats.error);
    }

    // Helper function to round numbers to avoid BigQuery NUMERIC precision errors
    const roundToDecimal = (num: any, decimals = 6) => {
      if (num === null || num === undefined || isNaN(num)) return 0;
      return Math.round(Number(num) * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    const analyticsData = {
      analytics_id: uuidv4(),
      user_id: snaptradeUserId,
      account_id: accountId || null,
      calculation_date: format(new Date(), 'yyyy-MM-dd'),
      calculation_timestamp: new Date().toISOString(),
      total_portfolio_value: roundToDecimal(performance.totalValue),
      total_cash: 0, // Will be calculated from holdings
      total_equities: 0,
      total_options: 0,
      total_crypto: 0,
      total_unrealized_pnl: roundToDecimal(performance.totalPnL),
      total_realized_pnl: roundToDecimal(tradeStats.totalRealizedPnL),
      total_return_percentage: roundToDecimal(performance.totalReturnPercentage),
      volatility: roundToDecimal(performance.volatility),
      sharpe_ratio: roundToDecimal(performance.sharpeRatio),
      win_rate: roundToDecimal(tradeStats.winRate),
      profit_factor: roundToDecimal(tradeStats.profitFactor),
      position_count: performance.positionCount || 0,
      top_position_concentration: 0, // Will be calculated
      top5_concentration: 0,
      top10_concentration: 0,
      risk_score: 0, // Will be calculated
      diversification_score: 0,
      created_at: new Date().toISOString()
    };

    await upsertData('portfolio_analytics', [analyticsData], ['user_id', 'account_id', 'calculation_date']);
    return 1;
  } catch (error) {
    console.error('Error loading portfolio analytics:', error);
    throw error;
  }
}

// Load trade statistics into BigQuery
export async function loadTradeStatistics(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string,
  periods: Array<'day' | 'week' | 'month' | 'year' | 'all'> = ['day', 'week', 'month', 'year', 'all']
) {
  try {
    
    const statisticsData = [];
    
    for (const period of periods) {
      const stats = await getTradeSummaryStats(snaptradeUserId, userSecret, period);
      
      if ('error' in stats) {
        continue;
      }

      const periodStart = getPeriodStart(period);
      const periodEnd = new Date();

      const statsData = {
        stats_id: uuidv4(),
        user_id: snaptradeUserId,
        account_id: accountId || null,
        period_type: period,
        period_start: periodStart ? format(periodStart, 'yyyy-MM-dd') : null,
        period_end: format(periodEnd, 'yyyy-MM-dd'),
        calculation_timestamp: new Date().toISOString(),
        total_trades: stats.totalTrades || 0,
        closed_trades: stats.closedTrades || 0,
        winning_trades: stats.winningTrades || 0,
        losing_trades: stats.losingTrades || 0,
        total_realized_pnl: safeNumeric(stats.totalRealizedPnL),
        total_fees: safeNumeric(stats.totalFees),
        avg_win: safeNumeric(stats.avgWin),
        avg_loss: safeNumeric(stats.avgLoss),
        largest_win: safeNumeric(stats.largestWin?.amount),
        largest_loss: safeNumeric(stats.largestLoss?.amount),
        win_rate: safeNumeric(stats.winRate),
        profit_factor: safeNumeric(stats.profitFactor),
        most_traded_symbols: safeStringify(Array.from(stats.mostTradedSymbols.entries()).slice(0, 10)),
        trades_by_day: safeStringify(Array.from(stats.tradesByDay.entries()).slice(0, 30)),
        created_at: new Date().toISOString()
      };


      statisticsData.push(statsData);
    }

    if (statisticsData.length > 0) {
      await upsertData('trade_statistics', statisticsData, ['user_id', 'account_id', 'period_type']);
    }
    
    return statisticsData.length;
  } catch (error) {
    console.error('Error loading trade statistics:', error);
    throw error;
  }
}

// Helper function to get period start date
function getPeriodStart(period: string): Date | null {
  const now = new Date();
  
  switch (period) {
    case 'day':
      return new Date(now.setDate(now.getDate() - 1));
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case 'all':
      return null; // No start date for all-time stats
    default:
      return null;
  }
}

// Load all data for a user
export async function loadAllUserData(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    
    const results = {
      trades: 0,
      holdings: 0,
      analytics: 0,
      statistics: 0
    };

    // Load trades data (get ALL historical trades)
    try {
      results.trades = await loadTradesData(snaptradeUserId, userSecret, accountId);
    } catch (error) {
      console.error('Error loading trades:', error);
    }

    // Load holdings snapshot
    try {
      results.holdings = await loadHoldingsSnapshot(snaptradeUserId, userSecret, accountId);
    } catch (error) {
      console.error('Error loading holdings:', error);
    }

    // Load portfolio analytics
    try {
      results.analytics = await loadPortfolioAnalytics(snaptradeUserId, userSecret, accountId);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }

    // Load trade statistics
    try {
      results.statistics = await loadTradeStatistics(snaptradeUserId, userSecret, accountId);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }

    return results;
  } catch (error) {
    console.error('Error in loadAllUserData:', error);
    throw error;
  }
}
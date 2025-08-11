'use server';

import { runQuery } from './client';
import { format } from 'date-fns';

// Get portfolio overview from BigQuery
export async function getPortfolioOverviewFromBQ(userId: string, accountId?: string) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  
  const query = `
    WITH latest_analytics AS (
      SELECT *
      FROM \`trading_data.portfolio_analytics\`
      WHERE user_id = '${userId}' ${accountFilter}
      AND calculation_date = (
        SELECT MAX(calculation_date)
        FROM \`trading_data.portfolio_analytics\`
        WHERE user_id = '${userId}' ${accountFilter}
      )
    ),
    latest_holdings AS (
      SELECT *
      FROM \`trading_data.holdings_snapshots\`
      WHERE user_id = '${userId}' ${accountFilter}
      AND snapshot_date = (
        SELECT MAX(snapshot_date)
        FROM \`trading_data.holdings_snapshots\`
        WHERE user_id = '${userId}' ${accountFilter}
      )
    )
    SELECT 
      COALESCE(a.total_portfolio_value, h.total_balance) as totalBalance,
      COALESCE(h.cash_balance, 0) as totalCash,
      COALESCE(a.total_equities, 0) as totalEquities,
      COALESCE(a.total_options, 0) as totalOptions,
      COALESCE(a.total_crypto, 0) as totalCrypto,
      COALESCE(a.total_unrealized_pnl, h.total_unrealized_pnl, 0) as totalUnrealizedPnL,
      COALESCE(a.total_realized_pnl, 0) as totalRealizedPnL,
      COALESCE(a.total_return_percentage, 0) as totalReturnPercentage,
      COALESCE(h.buying_power, 0) as buyingPower,
      a.calculation_date as lastUpdated
    FROM latest_analytics a
    FULL OUTER JOIN latest_holdings h ON a.user_id = h.user_id AND a.account_id = h.account_id
  `;

  const results = await runQuery(query);
  return results[0] || {
    totalBalance: 0,
    totalCash: 0,
    totalEquities: 0,
    totalOptions: 0,
    totalCrypto: 0,
    totalUnrealizedPnL: 0,
    totalRealizedPnL: 0,
    totalReturnPercentage: 0,
    buyingPower: 0,
    lastUpdated: null
  };
}

// Get trade statistics from BigQuery
export async function getTradeStatisticsFromBQ(
  userId: string,
  accountId?: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'month'
) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  
  const query = `
    SELECT *
    FROM \`trading_data.trade_statistics\`
    WHERE user_id = '${userId}' 
    AND period_type = '${period}' ${accountFilter}
    ORDER BY calculation_timestamp DESC
    LIMIT 1
  `;

  const results = await runQuery(query);
  return results[0] || {
    totalTrades: 0,
    closedTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalRealizedPnL: 0,
    totalFees: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    largestWin: 0,
    largestLoss: 0,
    mostTradedSymbols: '[]',
    tradesByDay: '[]'
  };
}

// Get top positions from BigQuery
export async function getTopPositionsFromBQ(userId: string, accountId?: string, limit: number = 10) {
  const accountFilter = accountId ? `AND h.account_id = '${accountId}'` : '';
  
  const query = `
    WITH latest_holdings AS (
      SELECT *
      FROM \`trading_data.holdings_snapshots\`
      WHERE user_id = '${userId}' ${accountFilter}
      AND snapshot_date = (
        SELECT MAX(snapshot_date)
        FROM \`trading_data.holdings_snapshots\`
        WHERE user_id = '${userId}' ${accountFilter}
      )
    ),
    position_data AS (
      SELECT 
        JSON_EXTRACT_SCALAR(position, '$.symbol.symbol.symbol') as symbol,
        JSON_EXTRACT_SCALAR(position, '$.symbol.symbol.description') as description,
        CAST(JSON_EXTRACT_SCALAR(position, '$.units') AS NUMERIC) * 
        CAST(JSON_EXTRACT_SCALAR(position, '$.price') AS NUMERIC) as value,
        CAST(JSON_EXTRACT_SCALAR(position, '$.units') AS NUMERIC) as units,
        CAST(JSON_EXTRACT_SCALAR(position, '$.price') AS NUMERIC) as price,
        CAST(JSON_EXTRACT_SCALAR(position, '$.open_pnl') AS NUMERIC) as unrealizedPnL,
        'equity' as type
      FROM latest_holdings h,
      UNNEST(JSON_EXTRACT_ARRAY(h.positions)) as position
      WHERE JSON_EXTRACT_SCALAR(position, '$.symbol.symbol.symbol') IS NOT NULL
      
      UNION ALL
      
      SELECT 
        JSON_EXTRACT_SCALAR(option, '$.symbol.option_symbol.ticker') as symbol,
        CONCAT(
          JSON_EXTRACT_SCALAR(option, '$.symbol.option_symbol.underlying_symbol.symbol'),
          ' ', 
          JSON_EXTRACT_SCALAR(option, '$.symbol.option_symbol.option_type')
        ) as description,
        ABS(CAST(JSON_EXTRACT_SCALAR(option, '$.units') AS NUMERIC) * 
            CAST(JSON_EXTRACT_SCALAR(option, '$.price') AS NUMERIC) * 100) as value,
        CAST(JSON_EXTRACT_SCALAR(option, '$.units') AS NUMERIC) as units,
        CAST(JSON_EXTRACT_SCALAR(option, '$.price') AS NUMERIC) as price,
        CAST(JSON_EXTRACT_SCALAR(option, '$.units') AS NUMERIC) * 
        CAST(JSON_EXTRACT_SCALAR(option, '$.price') AS NUMERIC) * 100 -
        CAST(JSON_EXTRACT_SCALAR(option, '$.units') AS NUMERIC) * 
        CAST(JSON_EXTRACT_SCALAR(option, '$.average_purchase_price') AS NUMERIC) as unrealizedPnL,
        'option' as type
      FROM latest_holdings h,
      UNNEST(JSON_EXTRACT_ARRAY(h.option_positions)) as option
      WHERE JSON_EXTRACT_SCALAR(option, '$.symbol.option_symbol.ticker') IS NOT NULL
    )
    SELECT *
    FROM position_data
    WHERE value > 0
    ORDER BY value DESC
    LIMIT ${limit}
  `;

  return await runQuery(query);
}

// Get performance metrics from BigQuery
export async function getPerformanceMetricsFromBQ(userId: string, accountId?: string) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  
  const query = `
    WITH latest_analytics AS (
      SELECT *
      FROM \`trading_data.portfolio_analytics\`
      WHERE user_id = '${userId}' ${accountFilter}
      AND calculation_date = (
        SELECT MAX(calculation_date)
        FROM \`trading_data.portfolio_analytics\`
        WHERE user_id = '${userId}' ${accountFilter}
      )
    ),
    historical_performance AS (
      SELECT 
        calculation_date,
        total_portfolio_value,
        total_return_percentage
      FROM \`trading_data.portfolio_analytics\`
      WHERE user_id = '${userId}' ${accountFilter}
      ORDER BY calculation_date DESC
      LIMIT 12
    )
    SELECT 
      la.total_portfolio_value as totalValue,
      la.total_unrealized_pnl as totalPnL,
      la.total_return_percentage as totalReturnPercentage,
      la.volatility,
      la.sharpe_ratio as sharpeRatio,
      la.position_count as positionCount,
      ARRAY_AGG(
        STRUCT(
          FORMAT_DATE('%b', hp.calculation_date) as month,
          CAST(hp.total_portfolio_value AS INT64) as portfolio,
          FORMAT_DATE('%Y-%m-%d', hp.calculation_date) as date
        ) 
        ORDER BY hp.calculation_date
      ) as historicalData,
      la.calculation_timestamp as lastUpdated
    FROM latest_analytics la
    CROSS JOIN historical_performance hp
    GROUP BY la.total_portfolio_value, la.total_unrealized_pnl, la.total_return_percentage,
             la.volatility, la.sharpe_ratio, la.position_count, la.calculation_timestamp
  `;

  const results = await runQuery(query);
  return results[0] || {
    totalValue: 0,
    totalPnL: 0,
    totalReturnPercentage: 0,
    volatility: 0,
    sharpeRatio: 0,
    positionCount: 0,
    historicalData: [],
    lastUpdated: null
  };
}

// Get portfolio composition from BigQuery
export async function getPortfolioCompositionFromBQ(userId: string, accountId?: string) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  
  const query = `
    WITH latest_analytics AS (
      SELECT *
      FROM \`trading_data.portfolio_analytics\`
      WHERE user_id = '${userId}' ${accountFilter}
      AND calculation_date = (
        SELECT MAX(calculation_date)
        FROM \`trading_data.portfolio_analytics\`
        WHERE user_id = '${userId}' ${accountFilter}
      )
    )
    SELECT 
      CASE 
        WHEN total_portfolio_value > 0 THEN
          STRUCT(
            ROUND((total_cash / total_portfolio_value) * 100, 2) as cash,
            ROUND((total_equities / total_portfolio_value) * 100, 2) as equities,
            ROUND((total_options / total_portfolio_value) * 100, 2) as options,
            ROUND((total_crypto / total_portfolio_value) * 100, 2) as crypto,
            ROUND(((total_portfolio_value - total_cash - total_equities - total_options - total_crypto) / total_portfolio_value) * 100, 2) as other
          )
        ELSE
          STRUCT(0 as cash, 0 as equities, 0 as options, 0 as crypto, 0 as other)
      END as composition
    FROM latest_analytics
  `;

  const results = await runQuery(query);
  return results[0]?.composition || {
    cash: 0,
    equities: 0,
    options: 0,
    crypto: 0,
    other: 0
  };
}

// Get recent trades from BigQuery
export async function getRecentTradesFromBQ(
  userId: string, 
  accountId?: string, 
  limit: number = 20
) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  
  const query = `
    SELECT 
      trade_id,
      symbol,
      instrument,
      action,
      position,
      units,
      price,
      total_value,
      fee,
      currency,
      trade_date,
      executed_at,
      is_option,
      option_underlying,
      option_type,
      option_strike,
      option_expiration,
      entry_price,
      exit_price,
      realized_pnl,
      holding_period,
      trade_status
    FROM \`trading_data.raw_trades\`
    WHERE user_id = '${userId}' ${accountFilter}
    ORDER BY executed_at DESC
    LIMIT ${limit}
  `;

  return await runQuery(query);
}

// Calculate portfolio risk metrics from BigQuery
export async function getRiskMetricsFromBQ(userId: string, accountId?: string) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  
  const query = `
    WITH latest_analytics AS (
      SELECT *
      FROM \`trading_data.portfolio_analytics\`
      WHERE user_id = '${userId}' ${accountFilter}
      AND calculation_date = (
        SELECT MAX(calculation_date)
        FROM \`trading_data.portfolio_analytics\`
        WHERE user_id = '${userId}' ${accountFilter}
      )
    )
    SELECT 
      risk_score,
      diversification_score,
      top_position_concentration,
      top5_concentration,
      top10_concentration
    FROM latest_analytics
  `;

  const results = await runQuery(query);
  return results[0] || {
    risk_score: 0,
    diversification_score: 0,
    top_position_concentration: 0,
    top5_concentration: 0,
    top10_concentration: 0
  };
}

// Get trades summary by period from BigQuery
export async function getTradesSummaryByPeriod(
  userId: string, 
  accountId?: string,
  days: number = 30
) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const query = `
    SELECT 
      trade_date,
      COUNT(*) as trade_count,
      SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN realized_pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
      SUM(realized_pnl) as total_pnl,
      SUM(fee) as total_fees
    FROM \`trading_data.raw_trades\`
    WHERE user_id = '${userId}' ${accountFilter}
    AND trade_date >= '${format(startDate, 'yyyy-MM-dd')}'
    AND realized_pnl IS NOT NULL
    GROUP BY trade_date
    ORDER BY trade_date DESC
  `;

  return await runQuery(query);
}

// Get symbol performance from BigQuery
export async function getSymbolPerformanceFromBQ(
  userId: string, 
  accountId?: string,
  limit: number = 10
) {
  const accountFilter = accountId ? `AND account_id = '${accountId}'` : '';
  
  const query = `
    SELECT 
      symbol,
      COUNT(*) as trade_count,
      SUM(realized_pnl) as total_pnl,
      AVG(realized_pnl) as avg_pnl,
      SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN realized_pnl <= 0 THEN 1 ELSE 0 END) as losing_trades,
      ROUND(
        SAFE_DIVIDE(
          SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END),
          COUNT(*)
        ) * 100, 2
      ) as win_rate
    FROM \`trading_data.raw_trades\`
    WHERE user_id = '${userId}' ${accountFilter}
    AND realized_pnl IS NOT NULL
    AND trade_status = 'closed'
    GROUP BY symbol
    HAVING trade_count >= 2
    ORDER BY total_pnl DESC
    LIMIT ${limit}
  `;

  return await runQuery(query);
}
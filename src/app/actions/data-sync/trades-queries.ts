import { BigQuery } from '@google-cloud/bigquery';

export interface TradeStats {
  totalRealizedPnL: number;
  winningTrades: number;
  losingTrades: number;
  closedTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
}

export interface SymbolSummary {
  symbol: string;
  totalTrades: number;
  realizedPnL: number;
  winRate: number;
}

export async function getTradeSummaryStats(
  userId: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'all',
): Promise<TradeStats> {
  const bigquery = new BigQuery();
  const datasetId = 'trading_data';

  // Create date filter based on period
  let dateFilter = '';
  if (period !== 'all') {
    dateFilter = `
      AND closed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 ${period.toUpperCase()})
    `;
  }

  const query = `
    WITH PositionStats AS (
      SELECT
        COUNT(*) as total_positions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_positions,
        COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as winning_positions,
        COUNT(CASE WHEN realized_pnl < 0 THEN 1 END) as losing_positions,
        SUM(realized_pnl) as total_pnl,
        SUM(CASE WHEN realized_pnl > 0 THEN realized_pnl END) as total_wins,
        SUM(CASE WHEN realized_pnl < 0 THEN ABS(realized_pnl) END) as total_losses,
        AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl END) as avg_win,
        AVG(CASE WHEN realized_pnl < 0 THEN ABS(realized_pnl) END) as avg_loss
      FROM \`${datasetId}.positions\`
      WHERE user_id = @userId
        AND status = 'closed'
        ${dateFilter}
    )
    SELECT
      ROUND(total_pnl, 2) as totalRealizedPnL,
      winning_positions as winningTrades,
      losing_positions as losingTrades,
      closed_positions as closedTrades,
      ROUND(SAFE_DIVIDE(winning_positions * 100, closed_positions), 1) as winRate,
      ROUND(SAFE_DIVIDE(total_wins, total_losses), 2) as profitFactor,
      ROUND(COALESCE(avg_win, 0), 2) as avgWin,
      ROUND(COALESCE(avg_loss, 0), 2) as avgLoss,
      total_positions as totalTrades
    FROM PositionStats
  `;

  const [rows] = await bigquery.query({
    query,
    params: { userId }
  });

  return rows[0] || {
    totalRealizedPnL: 0,
    winningTrades: 0,
    losingTrades: 0,
    closedTrades: 0,
    winRate: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    totalTrades: 0
  };
}

export async function getTopSymbols(
  userId: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'all',
  limit: number = 5
): Promise<SymbolSummary[]> {
  const bigquery = new BigQuery();
  const datasetId = 'trading_data';

  let dateFilter = '';
  if (period !== 'all') {
    dateFilter = `
      AND closed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 ${period.toUpperCase()})
    `;
  }

  const query = `
    SELECT
      symbol,
      COUNT(*) as totalTrades,
      ROUND(SUM(realized_pnl), 2) as realizedPnL,
      ROUND(COUNTIF(realized_pnl > 0) * 100 / COUNT(*), 1) as winRate
    FROM \`${datasetId}.positions\`
    WHERE user_id = @userId
      AND status = 'closed'
      ${dateFilter}
    GROUP BY symbol
    ORDER BY totalTrades DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { userId, limit }
  });

  return rows;
}

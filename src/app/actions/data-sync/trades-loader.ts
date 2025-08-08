'use server';

import { BigQuery } from '@google-cloud/bigquery';
import { useAuth } from '@/hooks/use-auth';

export interface TradesResponse {
  trades: any[];
  positions: any[];
  error?: string;
}

export async function getTradesFromBigQuery(
  userId: string,
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'all'
): Promise<TradesResponse> {
  const bigquery = new BigQuery();
  const datasetId = 'trading_data';

  let dateFilter = '';
  if (period !== 'all') {
    dateFilter = `
      AND t.trade_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 ${period.toUpperCase()})
    `;
  }

  try {
    // Get trades with position info joined
    const [rows] = await bigquery.query({
      query: `
        SELECT
          t.*,
          p.status as position_status,
          p.total_units as position_total_units,
          p.remaining_units as position_remaining_units,
          p.average_entry_price as position_entry_price,
          p.average_exit_price as position_exit_price,
          p.realized_pnl as position_pnl,
          TIMESTAMP_DIFF(p.closed_at, p.opened_at, DAY) as position_holding_period
        FROM \`${datasetId}.trades\` t
        LEFT JOIN \`${datasetId}.positions\` p
          ON t.position_id = p.id
          AND t.user_id = p.user_id
        WHERE t.user_id = @userId
        ${dateFilter}
        ORDER BY t.executed_at DESC
      `,
      params: { userId }
    });

    // Get positions
    const [positions] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${datasetId}.positions\`
        WHERE user_id = @userId
        ${dateFilter}
        ORDER BY opened_at DESC
      `,
      params: { userId }
    });

    return {
      trades: rows,
      positions: positions
    };
  } catch (error: any) {
    console.error('Error fetching trades from BigQuery:', error);
    return {
      trades: [],
      positions: [],
      error: error.message
    };
  }
}

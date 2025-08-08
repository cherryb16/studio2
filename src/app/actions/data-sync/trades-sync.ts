import { BigQuery } from '@google-cloud/bigquery';
import { getEnhancedTrades } from '../snaptrade-trades';
import { snaptrade } from '../snaptrade-client';
import { format } from 'date-fns';

export async function syncUserTrades(
  userId: string,
  snaptradeUserId: string,
  userSecret: string,
  fullSync = false
) {
  const bigquery = new BigQuery();
  const datasetId = 'trading_data';
  
  // Get the latest sync time for this user
  const [lastSyncRows] = await bigquery.query({
    query: `
      SELECT MAX(synced_at) as last_sync
      FROM \`${datasetId}.trades\`
      WHERE user_id = @userId
    `,
    params: { userId }
  });
  
  const lastSync = lastSyncRows[0]?.last_sync;
  const startDate = fullSync ? new Date(2000, 0, 1) : lastSync || new Date(2000, 0, 1);

  // Fetch all trades from SnapTrade
  const trades = await getEnhancedTrades(
    snaptradeUserId,
    userSecret,
    startDate
  );

  if ('error' in trades) {
    throw new Error(`Failed to fetch trades: ${trades.error}`);
  }

  // Process trades for BigQuery format
  const tradesToInsert = trades.map(trade => ({
    id: trade.id,
    user_id: userId,
    account_id: trade.accountId,
    symbol: trade.symbol,
    instrument: trade.instrument,
    action: trade.action,
    position: trade.position,
    units: trade.units,
    price: trade.price,
    total_value: trade.totalValue,
    fee: trade.fee,
    currency: trade.currency,
    executed_at: trade.executedAt,
    trade_date: format(trade.executedAt, 'yyyy-MM-dd'),
    is_option: trade.isOption,
    status: trade.status,
    realized_pnl: trade.realizedPnL,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    holding_period: trade.holdingPeriod,
    option_details: trade.optionDetails,
    synced_at: new Date()
  }));

  // Process positions
  const positions = new Map<string, any>();
  
  for (const trade of trades) {
    const positionKey = trade.isOption ? 
      `${trade.symbol}_${trade.optionDetails?.strike}_${trade.optionDetails?.expiration}_${trade.optionDetails?.type}` : 
      trade.symbol;
      
    if (!positions.has(positionKey)) {
      positions.set(positionKey, {
        id: positionKey,
        user_id: userId,
        symbol: trade.symbol,
        is_option: trade.isOption,
        option_details: trade.optionDetails,
        status: 'open',
        opened_at: trade.executedAt,
        total_units: 0,
        remaining_units: 0,
        average_entry_price: 0,
        total_fees: 0,
        synced_at: new Date()
      });
    }
    
    const position = positions.get(positionKey)!;
    position.total_fees += trade.fee;
    
    if (trade.action === 'BUY') {
      const newUnits = position.total_units + trade.units;
      position.average_entry_price = (
        (position.average_entry_price * position.total_units) + 
        (trade.price * trade.units)
      ) / newUnits;
      position.total_units = newUnits;
      position.remaining_units += trade.units;
    } else {
      position.remaining_units -= trade.units;
      if (position.remaining_units === 0) {
        position.status = 'closed';
        position.closed_at = trade.executedAt;
        position.average_exit_price = trade.price;
        position.realized_pnl = trade.realizedPnL;
      }
    }
  }

  // Insert data in batches
  if (tradesToInsert.length > 0) {
    await bigquery
      .dataset(datasetId)
      .table('trades')
      .insert(tradesToInsert, { ignoreUnknownValues: true });
  }

  if (positions.size > 0) {
    await bigquery
      .dataset(datasetId)
      .table('positions')
      .insert([...positions.values()], { ignoreUnknownValues: true });
  }

  return {
    tradesCount: tradesToInsert.length,
    positionsCount: positions.size
  };
}

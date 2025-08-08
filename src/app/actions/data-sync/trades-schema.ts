import { BigQuery } from '@google-cloud/bigquery';

export const TRADES_TABLE_SCHEMA = [
  { name: 'id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'account_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
  { name: 'instrument', type: 'STRING', mode: 'REQUIRED' },
  { name: 'action', type: 'STRING', mode: 'REQUIRED' },
  { name: 'position', type: 'STRING', mode: 'REQUIRED' },
  { name: 'units', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'price', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'total_value', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'fee', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'currency', type: 'STRING', mode: 'REQUIRED' },
  { name: 'executed_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'trade_date', type: 'DATE', mode: 'REQUIRED' },
  { name: 'is_option', type: 'BOOLEAN', mode: 'REQUIRED' },
  { name: 'status', type: 'STRING', mode: 'REQUIRED' },
  { name: 'realized_pnl', type: 'FLOAT64', mode: 'NULLABLE' },
  { name: 'entry_price', type: 'FLOAT64', mode: 'NULLABLE' },
  { name: 'exit_price', type: 'FLOAT64', mode: 'NULLABLE' },
  { name: 'holding_period', type: 'INT64', mode: 'NULLABLE' },
  { name: 'option_details', type: 'RECORD', mode: 'NULLABLE', fields: [
    { name: 'underlying', type: 'STRING', mode: 'REQUIRED' },
    { name: 'strike', type: 'FLOAT64', mode: 'REQUIRED' },
    { name: 'expiration', type: 'DATE', mode: 'REQUIRED' },
    { name: 'type', type: 'STRING', mode: 'REQUIRED' }
  ]},
  { name: 'position_id', type: 'STRING', mode: 'NULLABLE' }, // Groups related trades
  { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
];

export const POSITIONS_TABLE_SCHEMA = [
  { name: 'id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
  { name: 'is_option', type: 'BOOLEAN', mode: 'REQUIRED' },
  { name: 'option_details', type: 'RECORD', mode: 'NULLABLE', fields: [
    { name: 'underlying', type: 'STRING', mode: 'REQUIRED' },
    { name: 'strike', type: 'FLOAT64', mode: 'REQUIRED' },
    { name: 'expiration', type: 'DATE', mode: 'REQUIRED' },
    { name: 'type', type: 'STRING', mode: 'REQUIRED' }
  ]},
  { name: 'status', type: 'STRING', mode: 'REQUIRED' },
  { name: 'opened_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'closed_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
  { name: 'total_units', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'remaining_units', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'average_entry_price', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'average_exit_price', type: 'FLOAT64', mode: 'NULLABLE' },
  { name: 'realized_pnl', type: 'FLOAT64', mode: 'NULLABLE' },
  { name: 'total_fees', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
];

export async function setupBigQueryTables() {
  const bigquery = new BigQuery();
  const datasetId = 'trading_data';
  const location = 'us-east1'; // Choose the location closest to most users

  // Create dataset if it doesn't exist
  try {
    await bigquery.createDataset(datasetId, {
      location,
    });
    console.log(`Dataset ${datasetId} created.`);
  } catch (e: any) {
    if (e.code !== 409) { // 409 means dataset already exists
      throw e;
    }
  }

  // Create trades table if it doesn't exist
  try {
    await bigquery.dataset(datasetId).createTable('trades', {
      schema: TRADES_TABLE_SCHEMA,
      timePartitioning: {
        type: 'DAY',
        field: 'trade_date'
      },
      clustering: {
        fields: ['user_id', 'symbol', 'is_option']
      }
    });
    console.log('Trades table created.');
  } catch (e: any) {
    if (e.code !== 409) {
      throw e;
    }
  }

  // Create positions table if it doesn't exist
  try {
    await bigquery.dataset(datasetId).createTable('positions', {
      schema: POSITIONS_TABLE_SCHEMA,
      timePartitioning: {
        type: 'DAY',
        field: 'opened_at'
      },
      clustering: {
        fields: ['user_id', 'symbol', 'is_option', 'status']
      }
    });
    console.log('Positions table created.');
  } catch (e: any) {
    if (e.code !== 409) {
      throw e;
    }
  }
}

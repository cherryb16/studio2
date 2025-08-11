// Test the fixed BigQuery insertion
const { BigQuery } = require('@google-cloud/bigquery');

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

const dataset = bigquery.dataset('trading_data');

async function testFixedInsert() {
  try {
    console.log('🧪 Testing fixed BigQuery insertion...');
    
    const correctTradeData = {
      trade_id: 'fixed-test-' + Date.now(),
      account_id: '3548c684-7c8f-4b7a-9717-f0ff46b7f143',
      user_id: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      symbol: 'AAPL',
      instrument: 'AAPL',
      action: 'BUY',
      position: 'long',
      units: 1.0,
      price: 150.50,
      total_value: 150.50,
      fee: 0.0,
      currency: 'USD',
      trade_date: '2024-01-15',
      settlement_date: null,
      executed_at: '2024-01-15T10:30:00Z',
      is_option: false,
      option_underlying: null,
      option_type: null,
      option_strike: null,
      option_expiration: null,
      entry_price: null,
      exit_price: null,
      realized_pnl: null,
      holding_period: null,
      trade_status: 'open',
      raw_snaptrade_data: {
        id: 'test-123',
        symbol: 'AAPL',
        action: 'BUY',
        price: 150.50,
        units: 1,
        executedAt: '2024-01-15T10:30:00Z'
      }, // Proper JSON object instead of stringified
      data_source: 'test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const table = dataset.table('raw_trades');
    await table.insert([correctTradeData]);
    
    console.log('✅ Fixed insert successful!');
    
    // Query to verify the data was inserted
    const query = `
      SELECT trade_id, symbol, action, units, price, raw_snaptrade_data
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE trade_id = '${correctTradeData.trade_id}'
    `;
    
    const [rows] = await bigquery.query(query);
    if (rows.length > 0) {
      console.log('✅ Data verification successful:', {
        trade_id: rows[0].trade_id,
        symbol: rows[0].symbol,
        raw_data_keys: Object.keys(rows[0].raw_snaptrade_data || {})
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Fixed insert test failed:', error.message);
    
    if (error.name === 'PartialFailureError') {
      console.log('PartialFailureError details:');
      if (error.errors && error.errors.length > 0) {
        error.errors.forEach((err, index) => {
          console.log(`  Error ${index + 1}:`, err);
        });
      }
    }
    
    return false;
  }
}

async function testTradeStatistics() {
  try {
    console.log('\n🧪 Testing trade statistics insertion...');
    
    const statsData = {
      stats_id: 'stats-test-' + Date.now(),
      user_id: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      account_id: '3548c684-7c8f-4b7a-9717-f0ff46b7f143',
      period_type: 'all',
      period_start: null,
      period_end: '2024-01-15',
      calculation_timestamp: new Date().toISOString(),
      total_trades: 100,
      closed_trades: 80,
      winning_trades: 52,
      losing_trades: 28,
      total_realized_pnl: 1500.50,
      total_fees: 0,
      avg_win: 125.50,
      avg_loss: -89.20,
      largest_win: 500.00,
      largest_loss: -250.00,
      win_rate: 65.0,
      profit_factor: 1.8,
      most_traded_symbols: [
        ['AAPL', 25],
        ['MSFT', 20],
        ['GOOGL', 15]
      ], // Array instead of stringified
      trades_by_day: [
        ['2024-01-01', 5],
        ['2024-01-02', 3],
        ['2024-01-03', 7]
      ], // Array instead of stringified
      created_at: new Date().toISOString()
    };
    
    const table = dataset.table('trade_statistics');
    await table.insert([statsData]);
    
    console.log('✅ Trade statistics insert successful!');
    return true;
  } catch (error) {
    console.error('❌ Trade statistics insert failed:', error.message);
    
    if (error.name === 'PartialFailureError') {
      console.log('PartialFailureError details:');
      if (error.errors && error.errors.length > 0) {
        error.errors.forEach((err, index) => {
          console.log(`  Error ${index + 1}:`, err);
        });
      }
    }
    
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Fixed BigQuery Insertions');
  console.log('====================================');
  
  const tradesTest = await testFixedInsert();
  const statsTest = await testTradeStatistics();
  
  if (tradesTest && statsTest) {
    console.log('\n🎉 All tests passed! BigQuery insertions are now fixed.');
    console.log('✅ The real SnapTrade data should now load properly.');
  } else {
    console.log('\n❌ Some tests failed. More debugging needed.');
  }
}

main().catch(console.error);
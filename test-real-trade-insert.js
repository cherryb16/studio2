// Test inserting a real trade structure to see the exact error
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

const dataset = bigquery.dataset('trading_data');

async function testRealTradeInsert() {
  try {
    console.log('🧪 Testing real trade data insertion...');
    
    // Create a trade structure similar to what we see in the logs
    const realTradeData = {
      trade_id: 'real-test-' + Date.now(),
      account_id: '3548c684-7c8f-4b7a-9717-f0ff46b7f143',
      user_id: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      symbol: 'NVDA',
      instrument: 'NVDA',
      action: 'BUY',
      position: 'long',
      units: 7.0,
      price: 117.6,
      total_value: 823.2,
      fee: 0.0,
      currency: 'USD',
      trade_date: '2025-01-27',
      settlement_date: null,
      executed_at: '2025-01-27T19:16:32Z',
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
      raw_snaptrade_data: JSON.stringify({
        tradeId: 'fc42ea41-3641-4109-8c24-84827329a2d0',
        symbol: 'NVDA',
        action: 'BUY',
        units: 7,
        price: 117.6,
        executedAt: new Date('2025-01-27T19:16:32Z'),
        isOption: false,
        realizedPnL: 0
      }),
      data_source: 'snaptrade',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('📊 Test trade data:');
    console.log(JSON.stringify(realTradeData, null, 2));
    
    const table = dataset.table('raw_trades');
    await table.insert([realTradeData]);
    
    console.log('✅ Real trade insertion successful!');
    return true;
    
  } catch (error) {
    console.error('❌ Real trade insertion failed:', error.message);
    
    if (error.name === 'PartialFailureError') {
      console.error('\n🔍 PartialFailureError details:');
      if (error.errors && error.errors.length > 0) {
        error.errors.forEach((err, index) => {
          console.error(`  Error ${index + 1}:`, JSON.stringify(err, null, 2));
        });
      }
    }
    
    return false;
  }
}

testRealTradeInsert();
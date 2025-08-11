// Fix BigQuery JSON field handling
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

const dataset = bigquery.dataset('trading_data');

async function testJSONInsertion() {
  try {
    console.log('🧪 Testing different JSON field approaches...');
    
    const table = dataset.table('raw_trades');
    
    // Test 1: String that can be parsed as JSON
    console.log('\n1️⃣ Testing stringified JSON...');
    
    const testData1 = {
      trade_id: 'json-test-1-' + Date.now(),
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
      raw_snaptrade_data: JSON.stringify({
        id: 'test-123',
        symbol: 'AAPL',
        action: 'BUY',
        price: 150.50,
        units: 1
      }),
      data_source: 'json-test-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    try {
      await table.insert([testData1]);
      console.log('✅ Stringified JSON approach worked!');
    } catch (error) {
      console.log('❌ Stringified JSON failed:', error.message);
      if (error.name === 'PartialFailureError') {
        error.errors?.forEach((err, index) => {
          console.log(`  Error ${index + 1}:`, err.errors[0]?.message);
        });
      }
    }
    
    // Test 2: BigQuery JSON constructor
    console.log('\n2️⃣ Testing BigQuery.json()...');
    
    const testData2 = {
      trade_id: 'json-test-2-' + Date.now(),
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
      raw_snaptrade_data: bigquery.json({
        id: 'test-456',
        symbol: 'AAPL',
        action: 'BUY',
        price: 150.50,
        units: 1
      }),
      data_source: 'json-test-2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    try {
      await table.insert([testData2]);
      console.log('✅ BigQuery.json() approach worked!');
    } catch (error) {
      console.log('❌ BigQuery.json() failed:', error.message);
      if (error.name === 'PartialFailureError') {
        error.errors?.forEach((err, index) => {
          console.log(`  Error ${index + 1}:`, err.errors[0]?.message);
        });
      }
    }
    
    // Test 3: Let's try inserting without the JSON fields first
    console.log('\n3️⃣ Testing without JSON fields...');
    
    const testData3 = {
      trade_id: 'json-test-3-' + Date.now(),
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
      data_source: 'json-test-3'
      // No JSON fields, no created_at/updated_at (they have defaults)
    };
    
    try {
      await table.insert([testData3]);
      console.log('✅ Insert without JSON fields worked!');
    } catch (error) {
      console.log('❌ Insert without JSON failed:', error.message);
      if (error.name === 'PartialFailureError') {
        error.errors?.forEach((err, index) => {
          console.log(`  Error ${index + 1}:`, err.errors[0]?.message);
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🔧 BigQuery JSON Field Fix Test');
  console.log('================================');
  
  await testJSONInsertion();
  
  console.log('\n🏁 JSON field test complete');
}

main().catch(console.error);
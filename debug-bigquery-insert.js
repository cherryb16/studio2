// Debug BigQuery insertion issues
const { BigQuery } = require('@google-cloud/bigquery');

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

const dataset = bigquery.dataset('trading_data');

async function debugInsertIssue() {
  try {
    console.log('🔍 Debugging BigQuery insert issues...');
    
    // Test 1: Simple insert with minimal data
    console.log('\n1️⃣ Testing simple insert into raw_trades...');
    
    const simpleTradeData = {
      trade_id: 'debug-test-' + Date.now(),
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
      raw_snaptrade_data: {},
      data_source: 'debug-test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const table = dataset.table('raw_trades');
    
    // Try direct insert first
    try {
      await table.insert([simpleTradeData]);
      console.log('✅ Simple insert successful');
    } catch (error) {
      console.log('❌ Simple insert failed:', error.message);
      
      // Log detailed error information
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
    
    // Test 2: Try with insertId for deduplication
    console.log('\n2️⃣ Testing insert with insertId...');
    
    const dataWithInsertId = {
      insertId: 'debug-test-insertid-' + Date.now(),
      json: {
        ...simpleTradeData,
        trade_id: 'debug-test-insertid-' + Date.now()
      }
    };
    
    try {
      await table.insert([dataWithInsertId]);
      console.log('✅ Insert with insertId successful');
    } catch (error) {
      console.log('❌ Insert with insertId failed:', error.message);
      
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
    
    // Test 3: Check table schema
    console.log('\n3️⃣ Checking table schema...');
    
    const [metadata] = await table.getMetadata();
    console.log('Table schema fields:');
    metadata.schema.fields.forEach(field => {
      console.log(`  ${field.name}: ${field.type} ${field.mode || 'NULLABLE'}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Debug script failed:', error);
    return false;
  }
}

async function testDataTypes() {
  try {
    console.log('\n4️⃣ Testing problematic data types...');
    
    // Test with different data types that might be causing issues
    const testData = {
      trade_id: 'type-test-' + Date.now(),
      account_id: '3548c684-7c8f-4b7a-9717-f0ff46b7f143',
      user_id: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      symbol: 'AAPL',
      instrument: 'AAPL',
      action: 'BUY',
      position: 'long',
      units: 1, // INTEGER instead of NUMERIC
      price: 150.5, // FLOAT instead of NUMERIC 
      total_value: 150.5,
      fee: 0,
      currency: 'USD',
      trade_date: '2024-01-15',
      settlement_date: null,
      executed_at: new Date().toISOString(), // Full ISO timestamp
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
      raw_snaptrade_data: { test: 'data' }, // Simple JSON object
      data_source: 'type-test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const table = dataset.table('raw_trades');
    await table.insert([testData]);
    console.log('✅ Type test successful');
    
    return true;
  } catch (error) {
    console.error('❌ Type test failed:', error.message);
    
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
  console.log('🐛 BigQuery Insert Debug Script');
  console.log('=================================');
  
  const basicTest = await debugInsertIssue();
  if (basicTest) {
    await testDataTypes();
  }
  
  console.log('\n🏁 Debug script complete');
}

main().catch(console.error);
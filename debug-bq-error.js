// Simple test to isolate BigQuery error with minimal logging
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

const dataset = bigquery.dataset('trading_data');

async function testMinimalInsert() {
  try {
    console.log('Testing minimal trade statistics insert...');
    
    // Create the simplest possible trade statistics row
    const testData = {
      stats_id: 'test-' + Date.now(),
      user_id: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      account_id: null,
      period_type: 'all',
      period_start: null,
      period_end: '2025-08-11',
      calculation_timestamp: new Date().toISOString(),
      total_trades: 100,
      closed_trades: 50,
      winning_trades: 30,
      losing_trades: 20,
      total_realized_pnl: 1000.50,
      total_fees: 25.00,
      avg_win: 50.25,
      avg_loss: -25.75,
      largest_win: 200.00,
      largest_loss: -150.00,
      win_rate: 60.0,
      profit_factor: 1.95,
      most_traded_symbols: '[]',  // Empty JSON string
      trades_by_day: '[]',        // Empty JSON string
      created_at: new Date().toISOString()
    };
    
    const table = dataset.table('trade_statistics');
    await table.insert([testData]);
    console.log('✅ Minimal insert successful!');
    
  } catch (error) {
    console.error('❌ Insert failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'PartialFailureError' && error.errors) {
      console.error('\n🔍 Detailed errors:');
      error.errors.forEach((err, i) => {
        console.error(`Error ${i + 1}:`, err);
      });
    }
  }
}

testMinimalInsert();
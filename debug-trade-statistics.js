// Debug trade_statistics insertion error
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

const dataset = bigquery.dataset('trading_data');

async function testTradeStatisticsInsertion() {
  try {
    console.log('🧪 Testing trade_statistics insertion...');
    
    // Create test data that matches the expected structure from the data loaders
    const testStatsData = {
      stats_id: 'debug-stats-' + Date.now(),
      user_id: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      account_id: '3548c684-7c8f-4b7a-9717-f0ff46b7f143',
      period_type: 'all',
      period_start: null, // This is nullable for 'all' period
      period_end: '2024-01-15',
      calculation_timestamp: new Date().toISOString(),
      total_trades: 100,
      closed_trades: 80,
      winning_trades: 52,
      losing_trades: 28,
      total_realized_pnl: 1500.50,
      total_fees: 0.0,
      avg_win: 125.50,
      avg_loss: -89.20,
      largest_win: 500.00,
      largest_loss: -250.00,
      win_rate: 65.0,
      profit_factor: 1.8,
      most_traded_symbols: JSON.stringify([
        ['AAPL', 25],
        ['MSFT', 20],
        ['GOOGL', 15]
      ]),
      trades_by_day: JSON.stringify([
        ['2024-01-01', 5],
        ['2024-01-02', 3],
        ['2024-01-03', 7]
      ]),
      created_at: new Date().toISOString()
    };
    
    console.log('📊 Test data structure:');
    console.log(JSON.stringify(testStatsData, null, 2));
    
    const table = dataset.table('trade_statistics');
    
    // Try direct insert
    console.log('\n🔄 Attempting insertion...');
    await table.insert([testStatsData]);
    
    console.log('✅ Trade statistics insertion successful!');
    
    // Query to verify
    const verifyQuery = `
      SELECT stats_id, period_type, total_trades, most_traded_symbols, trades_by_day
      FROM \`trade-insights-pro-su.trading_data.trade_statistics\`
      WHERE stats_id = @statsId
    `;
    
    const [rows] = await bigquery.query({
      query: verifyQuery,
      params: { statsId: testStatsData.stats_id }
    });
    
    if (rows.length > 0) {
      console.log('✅ Data verification successful:');
      console.log('  Stats ID:', rows[0].stats_id);
      console.log('  Period:', rows[0].period_type);
      console.log('  Total trades:', rows[0].total_trades);
      console.log('  Most traded symbols:', typeof rows[0].most_traded_symbols);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Trade statistics insertion failed:', error.message);
    
    if (error.name === 'PartialFailureError') {
      console.log('\n🔍 PartialFailureError details:');
      if (error.errors && error.errors.length > 0) {
        error.errors.forEach((err, index) => {
          console.log(`  Error ${index + 1}:`, JSON.stringify(err, null, 2));
        });
      }
    }
    
    return false;
  }
}

async function main() {
  console.log('🔧 Trade Statistics Debug Script');
  console.log('=================================');
  
  const success = await testTradeStatisticsInsertion();
  
  if (success) {
    console.log('\n🎉 Trade statistics insertion is working!');
  } else {
    console.log('\n❌ Trade statistics insertion needs fixing');
  }
}

main().catch(console.error);
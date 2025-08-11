// Test the final BigQuery insertion fix
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

const dataset = bigquery.dataset('trading_data');

async function testCompleteInsertion() {
  try {
    console.log('🎯 Testing complete BigQuery insertion with all fixes...');
    
    // Test raw trades
    console.log('\n1️⃣ Testing raw_trades insertion...');
    
    const tradesTable = dataset.table('raw_trades');
    const testTrade = {
      trade_id: 'final-test-' + Date.now(),
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
        units: 1,
        executedAt: '2024-01-15T10:30:00Z'
      }),
      data_source: 'final-test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await tradesTable.insert([testTrade]);
    console.log('✅ Raw trades insertion successful!');
    
    // Test trade statistics
    console.log('\n2️⃣ Testing trade_statistics insertion...');
    
    const statsTable = dataset.table('trade_statistics');
    const testStats = {
      stats_id: 'final-stats-' + Date.now(),
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
    
    await statsTable.insert([testStats]);
    console.log('✅ Trade statistics insertion successful!');
    
    // Test holdings snapshots
    console.log('\n3️⃣ Testing holdings_snapshots insertion...');
    
    const holdingsTable = dataset.table('holdings_snapshots');
    const testHoldings = {
      snapshot_id: 'final-holdings-' + Date.now(),
      user_id: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      account_id: '3548c684-7c8f-4b7a-9717-f0ff46b7f143',
      snapshot_date: '2024-01-15',
      snapshot_timestamp: new Date().toISOString(),
      total_balance: 50000.00,
      cash_balance: 5000.00,
      buying_power: 10000.00,
      positions: JSON.stringify([
        { symbol: 'AAPL', quantity: 10, market_value: 1500.00 },
        { symbol: 'MSFT', quantity: 5, market_value: 1000.00 }
      ]),
      option_positions: JSON.stringify([]),
      total_unrealized_pnl: 250.00,
      equities_balance: 40000.00,
      options_balance: 5000.00,
      crypto_balance: 0.00,
      other_balance: 0.00,
      raw_holdings_data: JSON.stringify({
        total_value: { value: 50000.00 },
        positions: [],
        balances: []
      }),
      created_at: new Date().toISOString()
    };
    
    await holdingsTable.insert([testHoldings]);
    console.log('✅ Holdings snapshots insertion successful!');
    
    // Verify data exists
    console.log('\n4️⃣ Verifying inserted data...');
    
    const verifyQuery = `
      SELECT 
        'raw_trades' as table_name, 
        COUNT(*) as row_count 
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE data_source = 'final-test'
      UNION ALL
      SELECT 
        'trade_statistics' as table_name, 
        COUNT(*) as row_count 
      FROM \`trade-insights-pro-su.trading_data.trade_statistics\`
      WHERE stats_id LIKE 'final-stats-%'
      UNION ALL
      SELECT 
        'holdings_snapshots' as table_name, 
        COUNT(*) as row_count 
      FROM \`trade-insights-pro-su.trading_data.holdings_snapshots\`
      WHERE snapshot_id LIKE 'final-holdings-%'
    `;
    
    const [rows] = await bigquery.query(verifyQuery);
    console.log('📊 Verification results:');
    rows.forEach(row => {
      console.log(`  ${row.table_name}: ${row.row_count} rows`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Final test failed:', error.message);
    
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
  console.log('🚀 Final BigQuery Insertion Test');
  console.log('=================================');
  
  const success = await testCompleteInsertion();
  
  if (success) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ BigQuery insertions are now working correctly');
    console.log('✅ Real SnapTrade data should now load properly');
  } else {
    console.log('\n❌ Tests failed - need more debugging');
  }
}

main().catch(console.error);
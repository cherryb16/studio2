// Simple verification of BigQuery data after the fixes
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'trade-insights-pro-su',
  keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
});

async function verifyBigQueryData() {
  try {
    console.log('🔍 Verifying BigQuery data after fixes...');
    console.log('==========================================');
    
    const userId = 'IuqIuHkBfJTICzmHRIEiFJgOSZ82';
    
    // Check overall data counts
    console.log('\n📊 Data Summary:');
    
    const summaryQuery = `
      SELECT 
        'raw_trades' as table_name,
        COUNT(*) as total_rows,
        COUNT(DISTINCT data_source) as data_sources,
        MIN(trade_date) as earliest_date,
        MAX(trade_date) as latest_date
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE user_id = @userId
      UNION ALL
      SELECT 
        'trade_statistics' as table_name,
        COUNT(*) as total_rows,
        COUNT(DISTINCT period_type) as data_sources,
        MIN(period_start) as earliest_date,
        MAX(period_end) as latest_date
      FROM \`trade-insights-pro-su.trading_data.trade_statistics\`
      WHERE user_id = @userId
      UNION ALL
      SELECT 
        'holdings_snapshots' as table_name,
        COUNT(*) as total_rows,
        1 as data_sources,
        MIN(snapshot_date) as earliest_date,
        MAX(snapshot_date) as latest_date
      FROM \`trade-insights-pro-su.trading_data.holdings_snapshots\`
      WHERE user_id = @userId
      UNION ALL
      SELECT 
        'portfolio_analytics' as table_name,
        COUNT(*) as total_rows,
        1 as data_sources,
        MIN(calculation_date) as earliest_date,
        MAX(calculation_date) as latest_date
      FROM \`trade-insights-pro-su.trading_data.portfolio_analytics\`
      WHERE user_id = @userId
    `;
    
    const [summaryRows] = await bigquery.query({
      query: summaryQuery,
      params: { userId }
    });
    
    summaryRows.forEach(row => {
      console.log(`  ${row.table_name}:`);
      console.log(`    • Rows: ${row.total_rows}`);
      console.log(`    • Sources/Types: ${row.data_sources}`);
      console.log(`    • Date range: ${row.earliest_date || 'N/A'} to ${row.latest_date || 'N/A'}`);
    });
    
    // Get specific trade data to see if real SnapTrade data is there
    console.log('\n🔍 Sample Recent Trades:');
    
    const tradesQuery = `
      SELECT 
        trade_id,
        symbol,
        action,
        units,
        price,
        total_value,
        trade_date,
        data_source,
        CASE 
          WHEN JSON_QUERY(raw_snaptrade_data, '$.symbol') IS NOT NULL 
          THEN 'Has SnapTrade data'
          ELSE 'No SnapTrade data'
        END as has_snaptrade_data
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE user_id = @userId
      ORDER BY executed_at DESC
      LIMIT 15
    `;
    
    const [tradeRows] = await bigquery.query({
      query: tradesQuery,
      params: { userId }
    });
    
    if (tradeRows.length === 0) {
      console.log('  ❌ No trades found for this user');
    } else {
      tradeRows.forEach((trade, index) => {
        console.log(`  ${index + 1}. ${trade.symbol} - ${trade.action} ${trade.units} @ $${trade.price} (${trade.data_source}) [${trade.has_snaptrade_data}]`);
      });
    }
    
    // Check for data sources
    console.log('\n📈 Data Sources Breakdown:');
    
    const sourcesQuery = `
      SELECT 
        data_source,
        COUNT(*) as trade_count,
        COUNT(DISTINCT symbol) as unique_symbols,
        SUM(total_value) as total_value,
        MIN(trade_date) as earliest_date,
        MAX(trade_date) as latest_date
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE user_id = @userId
      GROUP BY data_source
      ORDER BY trade_count DESC
    `;
    
    const [sourceRows] = await bigquery.query({
      query: sourcesQuery,
      params: { userId }
    });
    
    sourceRows.forEach(source => {
      console.log(`  ${source.data_source}:`);
      console.log(`    • Trades: ${source.trade_count}`);
      console.log(`    • Symbols: ${source.unique_symbols}`);
      console.log(`    • Total value: $${source.total_value?.toFixed(2) || '0.00'}`);
      console.log(`    • Date range: ${source.earliest_date} to ${source.latest_date}`);
    });
    
    // Check if we have real SnapTrade data (not test data)
    const realDataQuery = `
      SELECT COUNT(*) as real_snaptrade_trades
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE user_id = @userId
      AND data_source = 'snaptrade'
    `;
    
    const [realDataRows] = await bigquery.query({
      query: realDataQuery,
      params: { userId }
    });
    
    const realTradeCount = realDataRows[0]?.real_snaptrade_trades || 0;
    
    console.log('\n🎯 Status Assessment:');
    
    if (realTradeCount > 0) {
      console.log(`✅ SUCCESS: Found ${realTradeCount} real SnapTrade trades in BigQuery!`);
      console.log('✅ The BigQuery insertion fix is working correctly');
      console.log('✅ Real trading data is now being stored properly');
    } else {
      console.log('⚠️  No real SnapTrade data found yet');
      console.log('   This might mean:');
      console.log('   • The sync hasn\'t been run since the fix');
      console.log('   • The API call is still using old code');
      console.log('   • Need to trigger a fresh data sync');
    }
    
    return {
      success: true,
      realTradeCount,
      totalTables: summaryRows.length,
      totalRows: summaryRows.reduce((sum, row) => sum + row.total_rows, 0)
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🚀 BigQuery Data Verification');
  console.log('=============================');
  
  const result = await verifyBigQueryData();
  
  if (result.success) {
    console.log('\n📊 VERIFICATION COMPLETE');
    console.log(`   • Real SnapTrade trades: ${result.realTradeCount}`);
    console.log(`   • Total rows across tables: ${result.totalRows}`);
    console.log(`   • Tables with data: ${result.totalTables}`);
  } else {
    console.log('\n❌ Verification failed:', result.error);
  }
}

main().catch(console.error);
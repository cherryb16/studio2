// Test the exact data structure being generated for trade statistics
const admin = require('firebase-admin');
const { format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// Simulate the exact data structure being created in loadTradeStatistics
async function testStatsStructure() {
  try {
    console.log('Testing stats data structure...');
    
    // Mock trade stats similar to what getTradeSummaryStats returns
    const mockStats = {
      totalTrades: 150,
      closedTrades: 75,
      winningTrades: 45,
      losingTrades: 30,
      totalRealizedPnL: 2500.75,
      totalFees: 125.50,
      avgWin: 95.25,
      avgLoss: -65.80,
      largestWin: { amount: 500.00 },
      largestLoss: { amount: -350.00 },
      winRate: 60.0,
      profitFactor: 1.85,
      mostTradedSymbols: new Map([
        ['AAPL', 25],
        ['NVDA', 20],
        ['META', 15]
      ]),
      tradesByDay: new Map([
        ['2025-08-10', 5],
        ['2025-08-09', 8],
        ['2025-08-08', 3]
      ])
    };
    
    // Create the exact data structure that data-loaders.ts creates
    const period = 'all';
    const periodStart = null; // For 'all' period
    const periodEnd = new Date();
    const snaptradeUserId = 'IuqIuHkBfJTICzmHRIEiFJgOSZ82';
    const accountId = null;
    
    const statsData = {
      stats_id: uuidv4(),
      user_id: snaptradeUserId,
      account_id: accountId,
      period_type: period,
      period_start: periodStart ? format(periodStart, 'yyyy-MM-dd') : null,
      period_end: format(periodEnd, 'yyyy-MM-dd'),
      calculation_timestamp: new Date().toISOString(),
      total_trades: mockStats.totalTrades,
      closed_trades: mockStats.closedTrades,
      winning_trades: mockStats.winningTrades,
      losing_trades: mockStats.losingTrades,
      total_realized_pnl: mockStats.totalRealizedPnL,
      total_fees: mockStats.totalFees,
      avg_win: mockStats.avgWin,
      avg_loss: mockStats.avgLoss,
      largest_win: mockStats.largestWin.amount,
      largest_loss: mockStats.largestLoss.amount,
      win_rate: mockStats.winRate,
      profit_factor: mockStats.profitFactor,
      most_traded_symbols: JSON.stringify(Array.from(mockStats.mostTradedSymbols.entries()).slice(0, 10)),
      trades_by_day: JSON.stringify(Array.from(mockStats.tradesByDay.entries()).slice(0, 30)),
      created_at: new Date().toISOString()
    };
    
    console.log('\n📊 Generated stats data structure (basic fields):');
    console.log(`Stats for period: ${statsData.period_type}, trades: ${statsData.total_trades}, P&L: ${statsData.total_realized_pnl}`);
    
    // Test inserting this exact structure
    const { BigQuery } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery({
      projectId: 'trade-insights-pro-su',
      keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
    });
    
    const dataset = bigquery.dataset('trading_data');
    const table = dataset.table('trade_statistics');
    
    console.log('\n🚀 Testing insert...');
    await table.insert([statsData]);
    console.log('✅ Stats insert successful!');
    
  } catch (error) {
    console.error('❌ Stats insert failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'PartialFailureError' && error.errors) {
      console.error('\n🔍 Detailed errors:');
      error.errors.forEach((err, i) => {
        console.error(`Error ${i + 1}:`, JSON.stringify(err, null, 2));
      });
    }
  }
}

testStatsStructure();
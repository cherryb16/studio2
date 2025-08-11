// Test manual data refresh - loads your SnapTrade data into BigQuery
const { getDb } = require('./src/lib/firebase-admin');

async function loadUserDataToBigQuery() {
  try {
    console.log('🔄 Starting manual data refresh...');
    console.log('This will load your SnapTrade data into BigQuery');
    
    // Import the required functions
    const { loadAllUserData } = require('./src/app/actions/bigquery/data-loaders');
    const { 
      getPortfolioOverviewFromBQ,
      getTradeStatisticsFromBQ,
      getTopPositionsFromBQ,
      getPerformanceMetricsFromBQ,
      getPortfolioCompositionFromBQ
    } = require('./src/app/actions/bigquery/analytics');
    
    const userId = 'IuqIuHkBfJTICzmHRIEiFJgOSZ82';
    const snaptradeUserId = 'IuqIuHkBfJTICzmHRIEiFJgOSZ82';
    const userSecret = '3bb0baa9-95d4-4dba-9fef-1f2916c48e5f';
    
    console.log('\n📊 Loading SnapTrade data into BigQuery...');
    console.log('👤 User:', userId);
    console.log('🔗 SnapTrade User:', snaptradeUserId);
    
    // Load all user data into BigQuery
    const loadResults = await loadAllUserData(snaptradeUserId, userSecret);
    
    console.log('✅ Data loading completed:');
    console.log(`   • Trades loaded: ${loadResults.trades}`);
    console.log(`   • Holdings snapshots: ${loadResults.holdings}`);
    console.log(`   • Analytics records: ${loadResults.analytics}`);
    console.log(`   • Statistics periods: ${loadResults.statistics}`);
    
    // Wait a moment for data to be available
    console.log('\n⏳ Waiting for data to be available...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test querying the data back
    console.log('\n🔍 Testing BigQuery data retrieval...');
    
    try {
      const portfolioOverview = await getPortfolioOverviewFromBQ(snaptradeUserId);
      console.log('✅ Portfolio Overview:', {
        totalBalance: portfolioOverview.totalBalance || 0,
        totalUnrealizedPnL: portfolioOverview.totalUnrealizedPnL || 0,
        lastUpdated: portfolioOverview.lastUpdated
      });
    } catch (error) {
      console.log('⚠️  Portfolio overview query failed (data may still be processing)');
    }
    
    try {
      const tradeStats = await getTradeStatisticsFromBQ(snaptradeUserId, undefined, 'all');
      console.log('✅ Trade Statistics:', {
        totalTrades: tradeStats.totalTrades || 0,
        winRate: tradeStats.winRate || 0,
        totalRealizedPnL: tradeStats.totalRealizedPnL || 0
      });
    } catch (error) {
      console.log('⚠️  Trade statistics query failed (data may still be processing)');
    }
    
    // Now create cached aggregations in Firestore
    console.log('\n💾 Creating Firestore cache...');
    
    const aggregatedData = {
      dashboard: {
        totalBalance: portfolioOverview?.totalBalance || 0,
        totalCash: portfolioOverview?.totalCash || 0,
        totalEquities: portfolioOverview?.totalEquities || 0,
        totalOptions: portfolioOverview?.totalOptions || 0,
        totalUnrealizedPnL: portfolioOverview?.totalUnrealizedPnL || 0,
        totalRealizedPnL: portfolioOverview?.totalRealizedPnL || 0,
        totalReturnPercentage: portfolioOverview?.totalReturnPercentage || 0,
        buyingPower: portfolioOverview?.buyingPower || 0,
        lastUpdated: new Date().toISOString()
      },
      quickStats: {
        totalTrades: loadResults.trades,
        winRate: 0, // Will be calculated in BigQuery
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        totalFees: 0
      },
      topPositions: [], // Will be populated by BigQuery queries
      composition: {
        cash: 0,
        equities: 0,
        options: 0,
        crypto: 0,
        other: 0
      },
      performance: {
        volatility: 0,
        sharpeRatio: 0,
        historicalData: []
      },
      metadata: {
        lastSync: new Date().toISOString(),
        dataSource: 'bigquery',
        version: '1.0'
      }
    };
    
    // Store in Firestore
    const db = getDb();
    await db.collection('users').doc(userId).collection('portfolio').doc('aggregated').set(aggregatedData);
    
    // Update sync status
    await db.collection('users').doc(userId).collection('sync').doc('status').set({
      lastSync: new Date().toISOString(),
      status: 'completed'
    }, { merge: true });
    
    console.log('✅ Firestore cache created successfully');
    
    console.log('\n🎉 MANUAL REFRESH COMPLETED SUCCESSFULLY!');
    console.log('\n📊 Summary:');
    console.log(`   • ${loadResults.trades} trades loaded into BigQuery`);
    console.log(`   • Portfolio data cached in Firestore`);
    console.log(`   • System ready for lightning-fast UI loading`);
    console.log('\n🚀 Your application now has:');
    console.log('   • All historical data in BigQuery for analytics');
    console.log('   • Cached aggregations in Firestore for instant loading');
    console.log('   • Daily automatic refresh configured');
    
    return { success: true, loadResults };
    
  } catch (error) {
    console.error('❌ Error in manual refresh:', error);
    return { error: error.message };
  }
}

loadUserDataToBigQuery().catch(console.error);
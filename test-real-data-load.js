// Test loading real SnapTrade data into BigQuery
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Import the data loading function
async function testRealDataLoad() {
  try {
    console.log('🚀 Testing real SnapTrade data loading into BigQuery...');
    console.log('==================================================');
    
    // Get user config from Firestore
    console.log('\n1️⃣ Getting user configuration...');
    const configDoc = await db.collection('system').doc('sync-config').get();
    const config = configDoc.data();
    
    if (!config || !config.users || config.users.length === 0) {
      throw new Error('No user configuration found');
    }
    
    const user = config.users[0];
    console.log('✅ User configuration found:', {
      userId: user.userId,
      snaptradeUserId: user.snaptradeUserId,
      accountCount: user.accounts?.length || 0
    });
    
    // Import and call the data loading functions
    console.log('\n2️⃣ Importing BigQuery data loaders...');
    
    // We need to set up the Node.js environment to import ES modules
    const { loadAllUserData } = await import('./src/app/actions/bigquery/data-loaders.ts');
    
    console.log('✅ Data loaders imported successfully');
    
    // Load all data for the user
    console.log('\n3️⃣ Loading all SnapTrade data into BigQuery...');
    
    const results = await loadAllUserData(
      user.snaptradeUserId,
      user.userSecret
    );
    
    console.log('✅ Data loading complete!');
    console.log('📊 Results:', results);
    
    // Check what's in BigQuery now
    console.log('\n4️⃣ Verifying data in BigQuery...');
    
    const { BigQuery } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery({
      projectId: 'trade-insights-pro-su',
      keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
    });
    
    const countQuery = `
      SELECT 
        'raw_trades' as table_name,
        COUNT(*) as total_rows,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(created_at) as latest_entry
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE user_id = '${user.userId}'
      UNION ALL
      SELECT 
        'trade_statistics' as table_name,
        COUNT(*) as total_rows,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(created_at) as latest_entry
      FROM \`trade-insights-pro-su.trading_data.trade_statistics\`
      WHERE user_id = '${user.userId}'
      UNION ALL
      SELECT 
        'holdings_snapshots' as table_name,
        COUNT(*) as total_rows,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(created_at) as latest_entry
      FROM \`trade-insights-pro-su.trading_data.holdings_snapshots\`
      WHERE user_id = '${user.userId}'
    `;
    
    const [rows] = await bigquery.query(countQuery);
    
    console.log('📈 BigQuery Data Summary:');
    rows.forEach(row => {
      console.log(`  ${row.table_name}:`);
      console.log(`    • Total rows: ${row.total_rows}`);
      console.log(`    • Unique users: ${row.unique_users}`);
      console.log(`    • Latest entry: ${row.latest_entry}`);
    });
    
    // Get some sample trade data
    const sampleQuery = `
      SELECT 
        trade_id,
        symbol,
        action,
        units,
        price,
        trade_date,
        data_source
      FROM \`trade-insights-pro-su.trading_data.raw_trades\`
      WHERE user_id = '${user.userId}'
      ORDER BY executed_at DESC
      LIMIT 10
    `;
    
    const [sampleRows] = await bigquery.query(sampleQuery);
    
    console.log('\n📝 Sample Trades:');
    sampleRows.forEach((trade, index) => {
      console.log(`  ${index + 1}. ${trade.symbol} - ${trade.action} ${trade.units} @ $${trade.price} on ${trade.trade_date} (${trade.data_source})`);
    });
    
    return {
      success: true,
      results,
      dataInBigQuery: rows
    };
    
  } catch (error) {
    console.error('❌ Real data loading test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const result = await testRealDataLoad();
  
  if (result.success) {
    console.log('\n🎉 SUCCESS: Real SnapTrade data is now loading into BigQuery!');
    console.log('✅ The BigQuery insertion fixes are working properly');
  } else {
    console.log('\n❌ FAILED: Real data loading encountered issues');
    console.log('Error:', result.error);
  }
}

main().catch(console.error);
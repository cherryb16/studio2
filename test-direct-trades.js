// Test direct call to getEnhancedTrades to see how many trades we actually get
const admin = require('firebase-admin');

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

async function testDirectTradesCall() {
  try {
    console.log('Getting user config...');
    
    const db = admin.firestore();
    const configDoc = await db.collection('system').doc('sync-config').get();
    const config = configDoc.data();
    
    if (!config || !config.users || config.users.length === 0) {
      throw new Error('No user configuration found');
    }
    
    const user = config.users[0];
    console.log('User found:', user.userId);
    
    // Import the function dynamically (TypeScript file)
    const { getEnhancedTrades } = await import('./src/app/actions/snaptrade-trades.ts');
    
    console.log('Calling getEnhancedTrades with NO date filters...');
    const trades = await getEnhancedTrades(
      user.snaptradeUserId,
      user.userSecret
      // No startDate, endDate, or accountId - should get ALL trades
    );
    
    if ('error' in trades) {
      console.error('Error:', trades.error);
      return;
    }
    
    console.log(`✅ SUCCESS: Got ${trades.length} total trades`);
    
    // Show sample of trades
    if (trades.length > 0) {
      console.log('\n📊 Sample trades:');
      trades.slice(0, 5).forEach((trade, i) => {
        console.log(`${i + 1}. ${trade.symbol} ${trade.action} ${trade.units} @ $${trade.price} (${trade.executedAt.toISOString().split('T')[0]})`);
      });
      
      // Show date range
      const dates = trades.map(t => t.executedAt).sort((a, b) => a.getTime() - b.getTime());
      console.log(`\n📅 Date range: ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDirectTradesCall();
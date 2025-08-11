// Test SnapTrade API directly to see how many trades we get
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

async function testSnapTradeDirectly() {
  try {
    console.log('Getting user config...');
    
    const db = admin.firestore();
    const configDoc = await db.collection('system').doc('sync-config').get();
    const config = configDoc.data();
    
    const user = config.users[0];
    console.log('Testing with user:', user.userId);
    
    // Initialize SnapTrade client
    const { snaptrade } = await import('./src/app/actions/snaptrade-client.js');
    
    console.log('1. Getting user accounts...');
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: user.snaptradeUserId,
      userSecret: user.userSecret,
    });
    
    if (!accountsResponse.data || !Array.isArray(accountsResponse.data)) {
      console.error('No accounts found');
      return;
    }
    
    const accountIds = accountsResponse.data.map(acc => acc.id);
    console.log(`Found ${accountIds.length} accounts:`, accountIds);
    
    console.log('\\n2. Testing activities API with NO date filters...');
    const activitiesResponse = await snaptrade.transactionsAndReporting.getActivities({
      userId: user.snaptradeUserId,
      userSecret: user.userSecret,
      accounts: accountIds.join(','),
      // NO startDate or endDate - get ALL activities
    });
    
    console.log('Activities response status:', activitiesResponse.status);
    console.log('Activities count:', Array.isArray(activitiesResponse.data) ? activitiesResponse.data.length : 'not array');
    
    if (Array.isArray(activitiesResponse.data) && activitiesResponse.data.length > 0) {
      console.log('\\n✅ SUCCESS! Found', activitiesResponse.data.length, 'activities');
      
      // Filter to just trades
      const trades = activitiesResponse.data.filter(activity => 
        ['BUY', 'SELL', 'OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE'].includes(activity.type)
      );
      
      console.log('Trade activities:', trades.length);
      
      if (trades.length > 0) {
        console.log('\\n📊 Sample trades:');
        trades.slice(0, 5).forEach((trade, i) => {
          console.log(`${i + 1}. ${trade.symbol?.symbol || 'N/A'} ${trade.type} ${trade.units || trade.quantity} @ $${trade.price} (${trade.trade_date})`);
        });
        
        // Show date range
        const dates = trades.map(t => t.trade_date).filter(d => d).sort();
        console.log(`\\n📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
      }
    } else {
      console.log('❌ No activities returned');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSnapTradeDirectly();
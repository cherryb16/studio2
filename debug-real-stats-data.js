// Debug the actual data being generated for trade statistics
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

async function debugRealStatsData() {
  try {
    console.log('🔍 Debugging real stats data generation...');
    console.log('============================================');
    
    // Get user config
    const db = admin.firestore();
    const configDoc = await db.collection('system').doc('sync-config').get();
    const config = configDoc.data();
    
    if (!config || !config.users || config.users.length === 0) {
      throw new Error('No user configuration found');
    }
    
    const user = config.users[0];
    console.log('✅ User found:', user.userId);
    
    // Directly call the getTradeSummaryStats function to see what it returns
    console.log('\n🔄 Calling getTradeSummaryStats with period "all"...');
    
    // Import and call the function - we need to require/import it properly
    // For now, let's simulate calling the API endpoint that does this
    const fetch = require('node-fetch');
    
    // We'll trigger the sync and capture the error details
    console.log('📡 Making API call to trigger sync and capture error...');
    
    try {
      const response = await fetch('http://localhost:9003/api/portfolio/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId }),
        timeout: 30000
      });
      
      const result = await response.json();
      console.log('Response:', result);
      
    } catch (apiError) {
      console.log('API call failed, but we can still check server logs');
    }
    
    // Alternative approach: check the server logs or add temporary debugging
    console.log('\n💡 To debug this issue:');
    console.log('1. Add temporary console.log in the data-loaders.ts file');
    console.log('2. Log the exact statsData structure before insert');
    console.log('3. Look for null values or wrong data types');
    console.log('4. Check for Map objects that weren\'t converted to arrays');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugRealStatsData();
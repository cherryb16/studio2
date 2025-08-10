// Simple test script to verify Firestore setup
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "trade-insights-pro-su",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:dummy"
};

async function testFirestoreSetup() {
  try {
    console.log('🧪 Testing Firestore setup...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase initialized');
    
    // Test writing a sample position (this would normally require authentication)
    const testData = {
      id: 'test-position-1',
      userId: 'test-user-123',
      symbol: 'AAPL',
      marketValue: 10000,
      unrealizedPnL: 500,
      units: 100,
      instrumentType: 'stock',
      status: 'open',
      updatedAt: new Date()
    };
    
    console.log('📝 Testing Firestore write...');
    
    // Note: This will likely fail with permission denied, which is expected with our security rules
    try {
      await setDoc(doc(db, 'positions', testData.id), testData);
      console.log('✅ Test position written to Firestore');
    } catch (error) {
      if (error.code === 'permission-denied') {
        console.log('✅ Permission denied as expected (security rules working)');
      } else {
        console.error('❌ Unexpected error:', error);
        return false;
      }
    }
    
    console.log('🎉 Firestore setup test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Visit http://localhost:9003/dashboard');
    console.log('2. Connect your brokerage account in settings');
    console.log('3. Click "Quick Sync" to populate Firestore with your data');
    console.log('4. Watch the performance improvement! 🚀');
    
    return true;
    
  } catch (error) {
    console.error('❌ Firestore setup test failed:', error);
    return false;
  }
}

testFirestoreSetup();
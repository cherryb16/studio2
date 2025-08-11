// Simple user configuration for BigQuery sync
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

const db = admin.firestore();

async function configureUser() {
  try {
    console.log('🔧 Configuring user for BigQuery sync...');
    
    const userConfig = {
      userId: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      snaptradeUserId: 'IuqIuHkBfJTICzmHRIEiFJgOSZ82',
      userSecret: '3bb0baa9-95d4-4dba-9fef-1f2916c48e5f',
      accounts: [
        { id: '3548c684-7c8f-4b7a-9717-f0ff46b7f143', name: 'Robinhood Individual' },
        { id: '199a21b6-df11-436a-8513-26491bf44faa', name: 'Robinhood IRA Roth' }
      ],
      syncEnabled: true,
      lastSync: null
    };
    
    // Get existing config
    const configDoc = await db.collection('system').doc('sync-config').get();
    const existingConfig = configDoc.exists ? configDoc.data() : { users: [] };
    
    // Update or add user config
    const users = existingConfig?.users || [];
    const existingUserIndex = users.findIndex((u) => u.userId === userConfig.userId);
    
    if (existingUserIndex >= 0) {
      users[existingUserIndex] = userConfig;
      console.log('✅ Updated existing user configuration');
    } else {
      users.push(userConfig);
      console.log('✅ Added new user configuration');
    }
    
    // Save updated config
    await db.collection('system').doc('sync-config').set({ users });
    
    console.log('✅ STEP 2 COMPLETED: User configuration saved successfully');
    console.log('👤 User ID:', userConfig.userId);
    console.log('📊 SnapTrade User:', userConfig.snaptradeUserId); 
    console.log('🏦 Accounts configured:', userConfig.accounts.length);
    
    return userConfig;
    
  } catch (error) {
    console.error('❌ Error configuring user:', error);
    throw error;
  }
}

configureUser().catch(console.error);
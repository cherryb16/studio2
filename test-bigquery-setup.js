// Test BigQuery setup and user configuration
const { getDb } = require('./src/lib/firebase-admin');

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
      lastSync: undefined
    };
    
    const db = getDb();
    
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
    
    console.log('✅ User configuration saved successfully');
    console.log('👤 User ID:', userConfig.userId);
    console.log('📊 SnapTrade User:', userConfig.snaptradeUserId);
    console.log('🏦 Accounts:', userConfig.accounts.map(a => `${a.name} (${a.id})`).join(', '));
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error configuring user:', error);
    return { error: error.message };
  }
}

async function main() {
  console.log('🚀 BigQuery Setup Test');
  console.log('=====================');
  
  // Step 1: Test BigQuery connection
  console.log('\n1. Testing BigQuery connection...');
  try {
    const { BigQuery } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery({
      projectId: 'trade-insights-pro-su',
      keyFilename: '/Users/cherrybrayden/VSCode/studio2/trading-data-key.json'
    });
    
    const [datasets] = await bigquery.getDatasets();
    const tradingDataset = datasets.find(d => d.id === 'trading_data');
    
    if (tradingDataset) {
      console.log('✅ BigQuery connection successful');
      console.log('✅ trading_data dataset found');
    } else {
      console.log('❌ trading_data dataset not found');
    }
  } catch (error) {
    console.log('❌ BigQuery connection failed:', error.message);
  }
  
  // Step 2: Configure user for sync
  console.log('\n2. Configuring user for sync...');
  const configResult = await configureUser();
  
  if (configResult.success) {
    console.log('✅ Step 2 COMPLETE: User configured for BigQuery sync');
  } else {
    console.log('❌ Step 2 FAILED:', configResult.error);
    return;
  }
  
  console.log('\n🎉 Setup test completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('   • Start your server: npm run dev');
  console.log('   • Test manual refresh: node test-manual-refresh.js');
  console.log('   • Deploy to production when ready');
}

main().catch(console.error);
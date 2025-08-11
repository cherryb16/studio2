'use server';

import { loadAllUserData } from '../bigquery/data-loaders';
import { 
  getPortfolioOverviewFromBQ, 
  getTradeStatisticsFromBQ, 
  getTopPositionsFromBQ,
  getPerformanceMetricsFromBQ,
  getPortfolioCompositionFromBQ
} from '../bigquery/analytics';
import { getDb } from '@/lib/firebase-admin';
import { getSnapTradeAccounts } from '../data-sources/snaptrade/accounts';

interface UserSyncConfig {
  userId: string;
  snaptradeUserId: string;
  userSecret: string;
  accounts: Array<{ id: string; name: string }>;
  lastSync?: string;
  syncEnabled: boolean;
}

// Main daily refresh function - called by cron job
export async function performDailyRefresh() {
  try {
    
    // Get all users who have sync enabled
    const usersToSync = await getUsersForSync();
    
    const results = {
      totalUsers: usersToSync.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const user of usersToSync) {
      try {
        
        // Load all SnapTrade data into BigQuery
        await loadAllUserData(user.snaptradeUserId, user.userSecret);
        
        // Generate aggregated results and store in Firestore
        await updateFirestoreAggregations(user);
        
        // Update last sync timestamp
        await updateLastSyncTime(user.userId);
        
        results.successful++;
        
      } catch (error) {
        console.error(`Error syncing user ${user.snaptradeUserId}:`, error);
        results.failed++;
        results.errors.push(`User ${user.snaptradeUserId}: ${error.message}`);
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('Error in daily refresh:', error);
    throw error;
  }
}

// Get users configured for sync
async function getUsersForSync(): Promise<UserSyncConfig[]> {
  try {
    const db = getDb();
    const configDoc = await db.collection('system').doc('sync-config').get();
    
    if (!configDoc.exists) {
      return [];
    }
    
    const config = configDoc.data();
    return config?.users || [];
    
  } catch (error) {
    console.error('Error getting users for sync:', error);
    return [];
  }
}

// Helper function to convert BigQuery Big numbers to regular numbers for Firestore
function convertBigQueryNumbersForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle BigQuery Big number objects
  if (typeof obj === 'object' && obj.constructor && obj.constructor.name === 'Big') {
    return parseFloat(obj.toString());
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigQueryNumbersForFirestore(item));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigQueryNumbersForFirestore(value);
    }
    return converted;
  }
  
  return obj;
}

// Update Firestore with aggregated data for quick access
async function updateFirestoreAggregations(user: UserSyncConfig) {
  try {
    
    // Get aggregated data from BigQuery
    const portfolioOverview = await getPortfolioOverviewFromBQ(user.snaptradeUserId);
    const tradeStats = await getTradeStatisticsFromBQ(user.snaptradeUserId, undefined, 'month');
    const topPositions = await getTopPositionsFromBQ(user.snaptradeUserId, undefined, 10);
    const performanceMetrics = await getPerformanceMetricsFromBQ(user.snaptradeUserId);
    const composition = await getPortfolioCompositionFromBQ(user.snaptradeUserId);
    
    // Structure for quick UI loading
    const aggregatedData = {
      // Main dashboard data
      dashboard: {
        totalBalance: convertBigQueryNumbersForFirestore(portfolioOverview.totalBalance) || 0,
        totalCash: convertBigQueryNumbersForFirestore(portfolioOverview.totalCash) || 0,
        totalEquities: convertBigQueryNumbersForFirestore(portfolioOverview.totalEquities) || 0,
        totalOptions: convertBigQueryNumbersForFirestore(portfolioOverview.totalOptions) || 0,
        totalUnrealizedPnL: convertBigQueryNumbersForFirestore(portfolioOverview.totalUnrealizedPnL) || 0,
        totalRealizedPnL: convertBigQueryNumbersForFirestore(portfolioOverview.totalRealizedPnL) || 0,
        totalReturnPercentage: convertBigQueryNumbersForFirestore(portfolioOverview.totalReturnPercentage) || 0,
        buyingPower: convertBigQueryNumbersForFirestore(portfolioOverview.buyingPower) || 0,
        lastUpdated: new Date().toISOString()
      },
      
      // Quick stats for cards
      quickStats: {
        totalTrades: convertBigQueryNumbersForFirestore(tradeStats.totalTrades) || 0,
        winRate: convertBigQueryNumbersForFirestore(tradeStats.winRate) || 0,
        profitFactor: convertBigQueryNumbersForFirestore(tradeStats.profitFactor) || 0,
        avgWin: convertBigQueryNumbersForFirestore(tradeStats.avgWin) || 0,
        avgLoss: convertBigQueryNumbersForFirestore(tradeStats.avgLoss) || 0,
        totalFees: convertBigQueryNumbersForFirestore(tradeStats.totalFees) || 0
      },
      
      // Top positions for quick display
      topPositions: convertBigQueryNumbersForFirestore(topPositions.slice(0, 5).map(pos => ({
        symbol: pos.symbol,
        description: pos.description,
        value: pos.value,
        unrealizedPnL: pos.unrealizedPnL,
        type: pos.type
      }))),
      
      // Portfolio composition for charts
      composition: {
        cash: convertBigQueryNumbersForFirestore(composition.cash) || 0,
        equities: convertBigQueryNumbersForFirestore(composition.equities) || 0,
        options: convertBigQueryNumbersForFirestore(composition.options) || 0,
        crypto: convertBigQueryNumbersForFirestore(composition.crypto) || 0,
        other: convertBigQueryNumbersForFirestore(composition.other) || 0
      },
      
      // Performance data for charts
      performance: {
        volatility: convertBigQueryNumbersForFirestore(performanceMetrics.volatility) || 0,
        sharpeRatio: convertBigQueryNumbersForFirestore(performanceMetrics.sharpeRatio) || 0,
        historicalData: convertBigQueryNumbersForFirestore(performanceMetrics.historicalData) || []
      },
      
      // Metadata
      metadata: {
        lastSync: new Date().toISOString(),
        dataSource: 'bigquery',
        version: '1.0'
      }
    };
    
    // Store in Firestore for quick access
    const db = getDb();
    await db.collection('users').doc(user.userId).collection('portfolio').doc('aggregated').set(aggregatedData);
    
    
  } catch (error) {
    console.error('Error updating Firestore aggregations:', error);
    throw error;
  }
}

// Update last sync time
async function updateLastSyncTime(userId: string) {
  try {
    const db = getDb();
    await db.collection('users').doc(userId).collection('sync').doc('status').set({
      lastSync: new Date().toISOString(),
      status: 'completed'
    }, { merge: true });
  } catch (error) {
    console.error('Error updating last sync time:', error);
  }
}

// Function to enable/disable sync for a user
export async function configureSyncForUser(
  userId: string,
  snaptradeUserId: string,
  userSecret: string,
  enabled: boolean = true
) {
  try {
    // Get user's accounts
    const accounts = await getSnapTradeAccounts(snaptradeUserId, userSecret);
    
    if ('error' in accounts) {
      throw new Error(accounts.error);
    }
    
    const userConfig: UserSyncConfig = {
      userId,
      snaptradeUserId,
      userSecret,
      accounts: accounts.map(acc => ({ id: acc.id, name: acc.name || acc.id })),
      syncEnabled: enabled,
      lastSync: undefined
    };
    
    const db = getDb();
    
    // Get existing config
    const configDoc = await db.collection('system').doc('sync-config').get();
    const existingConfig = configDoc.exists ? configDoc.data() : { users: [] };
    
    // Update or add user config
    const users = existingConfig?.users || [];
    const existingUserIndex = users.findIndex((u: any) => u.userId === userId);
    
    if (existingUserIndex >= 0) {
      users[existingUserIndex] = userConfig;
    } else {
      users.push(userConfig);
    }
    
    // Save updated config
    await db.collection('system').doc('sync-config').set({ users });
    
    return { success: true };
    
  } catch (error) {
    console.error('Error configuring sync:', error);
    throw error;
  }
}

// Manual refresh function for a specific user
export async function refreshUserData(userId: string) {
  try {
    // Get user's sync config
    const db = getDb();
    const configDoc = await db.collection('system').doc('sync-config').get();
    
    if (!configDoc.exists) {
      throw new Error('No sync configuration found');
    }
    
    const config = configDoc.data();
    const userConfig = config?.users?.find((u: any) => u.userId === userId);
    
    if (!userConfig) {
      throw new Error('User not configured for sync');
    }
    
    if (!userConfig.syncEnabled) {
      throw new Error('Sync disabled for user');
    }
    
    
    // Load data into BigQuery
    await loadAllUserData(userConfig.snaptradeUserId, userConfig.userSecret);
    
    // Update Firestore aggregations
    await updateFirestoreAggregations(userConfig);
    
    // Update last sync time
    await updateLastSyncTime(userId);
    
    return { success: true, lastSync: new Date().toISOString() };
    
  } catch (error) {
    console.error('Error in manual refresh:', error);
    throw error;
  }
}
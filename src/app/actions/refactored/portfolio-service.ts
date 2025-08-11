'use server';

import { getDb } from '@/lib/firebase-admin';
import { 
  getPortfolioOverviewFromBQ,
  getTradeStatisticsFromBQ,
  getTopPositionsFromBQ,
  getPerformanceMetricsFromBQ,
  getPortfolioCompositionFromBQ,
  getRecentTradesFromBQ
} from '../bigquery/analytics';

// Get portfolio data optimized for quick UI loading
export async function getPortfolioData(userId: string, accountId?: string) {
  try {
    // First try to get cached data from Firestore for instant loading
    const cachedData = await getCachedPortfolioData(userId);
    
    if (cachedData) {
      // Return cached data immediately for fast UI
      return {
        ...cachedData,
        source: 'cache',
        cached: true
      };
    }
    
    // Fallback to BigQuery if no cached data (shouldn't happen after sync is set up)
    console.log('No cached data found, querying BigQuery directly');
    return await getPortfolioDataFromBQ(userId, accountId);
    
  } catch (error) {
    console.error('Error getting portfolio data:', error);
    return { error: 'Failed to get portfolio data.' };
  }
}

// Get cached portfolio data from Firestore
async function getCachedPortfolioData(userId: string) {
  try {
    const db = getDb();
    const docSnap = await db.collection('users').doc(userId).collection('portfolio').doc('aggregated').get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      
      // Check if data is recent (within last 24 hours)
      const lastSync = new Date(data.metadata?.lastSync);
      const now = new Date();
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSync <= 24) {
        return data;
      } else {
        console.log('Cached data is stale, will fallback to BigQuery');
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

// Get portfolio data directly from BigQuery (fallback)
async function getPortfolioDataFromBQ(userId: string, accountId?: string) {
  try {
    // Get all required data in parallel for better performance
    const [
      portfolioOverview,
      tradeStats,
      topPositions,
      performanceMetrics,
      composition
    ] = await Promise.all([
      getPortfolioOverviewFromBQ(userId, accountId),
      getTradeStatisticsFromBQ(userId, accountId, 'month'),
      getTopPositionsFromBQ(userId, accountId, 10),
      getPerformanceMetricsFromBQ(userId, accountId),
      getPortfolioCompositionFromBQ(userId, accountId)
    ]);
    
    return {
      dashboard: {
        totalBalance: portfolioOverview.totalBalance || 0,
        totalCash: portfolioOverview.totalCash || 0,
        totalEquities: portfolioOverview.totalEquities || 0,
        totalOptions: portfolioOverview.totalOptions || 0,
        totalUnrealizedPnL: portfolioOverview.totalUnrealizedPnL || 0,
        totalRealizedPnL: portfolioOverview.totalRealizedPnL || 0,
        totalReturnPercentage: portfolioOverview.totalReturnPercentage || 0,
        buyingPower: portfolioOverview.buyingPower || 0,
        lastUpdated: portfolioOverview.lastUpdated
      },
      
      quickStats: {
        totalTrades: tradeStats.totalTrades || 0,
        winRate: tradeStats.winRate || 0,
        profitFactor: tradeStats.profitFactor || 0,
        avgWin: tradeStats.avgWin || 0,
        avgLoss: tradeStats.avgLoss || 0,
        totalFees: tradeStats.totalFees || 0
      },
      
      topPositions: topPositions.slice(0, 5),
      composition,
      
      performance: {
        volatility: performanceMetrics.volatility || 0,
        sharpeRatio: performanceMetrics.sharpeRatio || 0,
        historicalData: performanceMetrics.historicalData || []
      },
      
      source: 'bigquery',
      cached: false
    };
    
  } catch (error) {
    console.error('Error getting portfolio data from BigQuery:', error);
    throw error;
  }
}

// Get detailed trade statistics
export async function getDetailedTradeStats(
  userId: string, 
  accountId?: string, 
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'month'
) {
  try {
    return await getTradeStatisticsFromBQ(userId, accountId, period);
  } catch (error) {
    console.error('Error getting trade statistics:', error);
    return { error: 'Failed to get trade statistics.' };
  }
}

// Get all top positions (not just cached ones)
export async function getAllTopPositions(
  userId: string, 
  accountId?: string, 
  limit: number = 20
) {
  try {
    return await getTopPositionsFromBQ(userId, accountId, limit);
  } catch (error) {
    console.error('Error getting top positions:', error);
    return { error: 'Failed to get top positions.' };
  }
}

// Get recent trading activity
export async function getRecentTradingActivity(
  userId: string, 
  accountId?: string, 
  limit: number = 50
) {
  try {
    return await getRecentTradesFromBQ(userId, accountId, limit);
  } catch (error) {
    console.error('Error getting recent trades:', error);
    return { error: 'Failed to get recent trades.' };
  }
}

// Get performance metrics with full historical data
export async function getDetailedPerformanceMetrics(userId: string, accountId?: string) {
  try {
    return await getPerformanceMetricsFromBQ(userId, accountId);
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return { error: 'Failed to get performance metrics.' };
  }
}

// Check if user has recent data
export async function checkDataFreshness(userId: string) {
  try {
    const db = getDb();
    const docSnap = await db.collection('users').doc(userId).collection('sync').doc('status').get();
    
    if (docSnap.exists) {
      const syncStatus = docSnap.data();
      const lastSync = new Date(syncStatus.lastSync);
      const now = new Date();
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
      
      return {
        hasRecentData: hoursSinceSync <= 24,
        lastSync: syncStatus.lastSync,
        hoursSinceSync: Math.round(hoursSinceSync),
        status: syncStatus.status
      };
    }
    
    return {
      hasRecentData: false,
      lastSync: null,
      hoursSinceSync: null,
      status: 'never_synced'
    };
  } catch (error) {
    console.error('Error checking data freshness:', error);
    return {
      hasRecentData: false,
      lastSync: null,
      hoursSinceSync: null,
      status: 'error'
    };
  }
}
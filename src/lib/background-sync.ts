// Background sync service for keeping Firestore data fresh
'use client';

import { SnapTradeFirestoreSync, SyncScheduler } from './snaptrade-firestore-sync';

interface SyncCredentials {
  userId: string;
  snaptradeUserId: string;
  userSecret: string;
}

export class BackgroundSyncService {
  private static intervals: Map<string, NodeJS.Timeout> = new Map();
  private static isMarketOpen = false;

  // Start background sync for a user
  static startSync(credentials: SyncCredentials, options = {
    quickSyncMinutes: 5,    // Sync every 5 minutes during market hours
    fullSyncHours: 24,      // Full sync once daily
    enableMarketHoursOnly: true
  }) {
    const userId = credentials.userId;
    
    // Clear existing intervals
    this.stopSync(userId);

    // Market hours check interval (every minute)
    const marketCheckInterval = setInterval(() => {
      const wasOpen = this.isMarketOpen;
      this.isMarketOpen = SyncScheduler.isMarketHours(new Date());
      
      if (wasOpen !== this.isMarketOpen) {
        console.log(`Market ${this.isMarketOpen ? 'opened' : 'closed'} - adjusting sync frequency`);
      }
    }, 60000);

    // Quick sync interval (during market hours)
    const quickSyncInterval = setInterval(async () => {
      if (!options.enableMarketHoursOnly || this.isMarketOpen) {
        try {
          console.log(`Starting quick sync for user ${userId}`);
          await SnapTradeFirestoreSync.quickSync(credentials);
          console.log(`Quick sync completed for user ${userId}`);
        } catch (error) {
          console.error(`Quick sync failed for user ${userId}:`, error);
        }
      }
    }, options.quickSyncMinutes * 60000);

    // Full sync interval (daily)
    const fullSyncInterval = setInterval(async () => {
      try {
        console.log(`Starting full sync for user ${userId}`);
        await SnapTradeFirestoreSync.fullSync(credentials);
        console.log(`Full sync completed for user ${userId}`);
      } catch (error) {
        console.error(`Full sync failed for user ${userId}:`, error);
      }
    }, options.fullSyncHours * 60 * 60000);

    // Store intervals for cleanup
    this.intervals.set(userId, quickSyncInterval);
    this.intervals.set(`${userId}_full`, fullSyncInterval);
    this.intervals.set(`${userId}_market`, marketCheckInterval);

    console.log(`Background sync started for user ${userId}`);
    
    // Initial sync
    this.triggerInitialSync(credentials);
  }

  // Stop background sync for a user
  static stopSync(userId: string) {
    const keys = [`${userId}`, `${userId}_full`, `${userId}_market`];
    
    keys.forEach(key => {
      const interval = this.intervals.get(key);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(key);
      }
    });

    console.log(`Background sync stopped for user ${userId}`);
  }

  // Stop all background syncs
  static stopAllSyncs() {
    this.intervals.forEach((interval, key) => {
      clearInterval(interval);
    });
    this.intervals.clear();
    console.log('All background syncs stopped');
  }

  // Trigger immediate sync
  static async triggerSync(credentials: SyncCredentials, fullSync = false) {
    try {
      const result = fullSync 
        ? await SnapTradeFirestoreSync.fullSync(credentials)
        : await SnapTradeFirestoreSync.quickSync(credentials);
      
      return result;
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  }

  // Initial sync when starting
  private static async triggerInitialSync(credentials: SyncCredentials) {
    try {
      // Do a quick sync immediately
      await SnapTradeFirestoreSync.quickSync(credentials);
      console.log(`Initial sync completed for user ${credentials.userId}`);
    } catch (error) {
      console.error(`Initial sync failed for user ${credentials.userId}:`, error);
    }
  }

  // Get sync status
  static getSyncStatus(userId: string) {
    const hasQuickSync = this.intervals.has(userId);
    const hasFullSync = this.intervals.has(`${userId}_full`);
    const hasMarketCheck = this.intervals.has(`${userId}_market`);

    return {
      isActive: hasQuickSync && hasFullSync && hasMarketCheck,
      isMarketOpen: this.isMarketOpen,
      activeIntervals: {
        quickSync: hasQuickSync,
        fullSync: hasFullSync,
        marketCheck: hasMarketCheck
      }
    };
  }
}

// Hook for managing background sync in React components
export function useBackgroundSync(credentials?: SyncCredentials) {
  const startSync = (creds = credentials) => {
    if (!creds) throw new Error('Credentials required');
    BackgroundSyncService.startSync(creds);
  };

  const stopSync = () => {
    if (!credentials) return;
    BackgroundSyncService.stopSync(credentials.userId);
  };

  const triggerSync = async (fullSync = false) => {
    if (!credentials) throw new Error('Credentials required');
    return await BackgroundSyncService.triggerSync(credentials, fullSync);
  };

  const getSyncStatus = () => {
    if (!credentials) return null;
    return BackgroundSyncService.getSyncStatus(credentials.userId);
  };

  return {
    startSync,
    stopSync,
    triggerSync,
    getSyncStatus
  };
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    BackgroundSyncService.stopAllSyncs();
  });
}
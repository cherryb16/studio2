// Note: This runs on client side, so we need client-side Firebase
import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface CacheEntry<T> {
  data: T;
  lastUpdated: number;
  ttl: number; // Time to live in milliseconds
}

interface Account {
  id: string;
  name: string;
  institution_name: string;
  [key: string]: any;
}

interface TradeData {
  trades: any[];
  lastUpdated: number;
  period: string;
}

const CACHE_DURATIONS = {
  ACCOUNTS: 24 * 60 * 60 * 1000, // 24 hours
  TRADES_RECENT: 60 * 60 * 1000, // 1 hour for recent data
  TRADES_HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours for historical data
  POSITIONS: 30 * 60 * 1000, // 30 minutes for positions
} as const;

export class CacheService {
  /**
   * Get accounts from cache or fetch from SnapTrade API
   */
  static async getAccounts(
    firebaseUserId: string,
    snaptradeUserId: string,
    userSecret: string,
    forceRefresh = false
  ): Promise<Account[]> {
    const cacheKey = `snaptrade_users/${firebaseUserId}/accounts`;
    
    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedData<Account[]>(cacheKey, CACHE_DURATIONS.ACCOUNTS);
        if (cachedData) {
          console.log('📦 Returning cached accounts');
          return cachedData;
        }
      }
      
      // Fetch from SnapTrade API using existing server function
      console.log('🌐 Fetching accounts from SnapTrade API');
      const response = await fetch(`/api/snaptrade/accounts?snaptradeUserId=${encodeURIComponent(snaptradeUserId)}&userSecret=${encodeURIComponent(userSecret)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch accounts from API: ${response.status} ${errorText}`);
      }
      
      const accounts = await response.json() as Account[];
      
      // Cache the result
      await this.setCachedData(cacheKey, accounts, CACHE_DURATIONS.ACCOUNTS);
      
      return accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      
      // Try to return stale cache data as fallback
      const staleData = await this.getStaleData<Account[]>(cacheKey);
      if (staleData) {
        console.log('⚠️ Returning stale accounts data');
        return staleData;
      }
      
      return [];
    }
  }

  /**
   * Get trades from cache or fetch from SnapTrade API
   */
  static async getTrades(
    firebaseUserId: string,
    snaptradeUserId: string,
    userSecret: string,
    period: string,
    startDate?: Date,
    forceRefresh = false
  ): Promise<any[]> {
    const dateKey = startDate ? startDate.toISOString().split('T')[0] : 'all';
    const cacheKey = `snaptrade_users/${firebaseUserId}/trades/${period}/${dateKey}`;
    
    // Determine TTL based on how recent the data is
    const isRecent = !startDate || (Date.now() - startDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7 days
    const ttl = isRecent ? CACHE_DURATIONS.TRADES_RECENT : CACHE_DURATIONS.TRADES_HISTORICAL;
    
    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedData<any[]>(cacheKey, ttl);
        if (cachedData) {
          console.log('📦 Returning cached trades');
          return cachedData;
        }
      }
      
      // Fetch from SnapTrade API (implementation would call existing trade functions)
      console.log('🌐 Fetching trades from SnapTrade API');
      // This would call your existing getEnhancedTrades function
      // For now, return empty array as placeholder
      const trades: any[] = [];
      
      // Cache the result
      await this.setCachedData(cacheKey, trades, ttl);
      
      return trades;
    } catch (error) {
      console.error('Error fetching trades:', error);
      
      // Try to return stale cache data as fallback
      const staleData = await this.getStaleData<any[]>(cacheKey);
      if (staleData) {
        console.log('⚠️ Returning stale trades data');
        return staleData;
      }
      
      return [];
    }
  }

  /**
   * Get positions from cache or fetch from SnapTrade API
   */
  static async getPositions(
    firebaseUserId: string,
    snaptradeUserId: string,
    userSecret: string,
    accountId?: string,
    forceRefresh = false
  ): Promise<any> {
    const cacheKey = `snaptrade_users/${firebaseUserId}/positions/${accountId || 'all'}`;
    
    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedData<any>(cacheKey, CACHE_DURATIONS.POSITIONS);
        if (cachedData) {
          console.log('📦 Returning cached positions');
          return cachedData;
        }
      }
      
      // Fetch from SnapTrade API (implementation would call existing position functions)
      console.log('🌐 Fetching positions from SnapTrade API');
      // This would call your existing getUserHoldings function
      // For now, return empty object as placeholder
      const positions = { positions: [], option_positions: [] };
      
      // Cache the result
      await this.setCachedData(cacheKey, positions, CACHE_DURATIONS.POSITIONS);
      
      return positions;
    } catch (error) {
      console.error('Error fetching positions:', error);
      
      // Try to return stale cache data as fallback
      const staleData = await this.getStaleData<any>(cacheKey);
      if (staleData) {
        console.log('⚠️ Returning stale positions data');
        return staleData;
      }
      
      return { positions: [], option_positions: [] };
    }
  }

  /**
   * Invalidate specific cache entries
   */
  static async invalidateCache(firebaseUserId: string, type: 'accounts' | 'trades' | 'positions' | 'all') {
    try {
      if (!db) {
        console.warn('Firestore not initialized, skipping cache invalidation');
        return;
      }

      if (type === 'all') {
        // Delete entire user cache
        const cacheDocRef = doc(db, 'cache', firebaseUserId);
        await deleteDoc(cacheDocRef);
      } else {
        // Delete specific cache type
        const cacheDocRef = doc(db, 'cache', firebaseUserId);
        const cacheDoc = await getDoc(cacheDocRef);
        
        if (cacheDoc.exists()) {
          const data = cacheDoc.data() || {};
          
          // Remove cache entries that match the type
          const updatedData = Object.keys(data).reduce((acc, key) => {
            if (!key.includes(`_${type}_`)) {
              acc[key] = data[key];
            }
            return acc;
          }, {} as any);
          
          await setDoc(cacheDocRef, updatedData);
        }
      }
      
      console.log(`🗑️ Invalidated ${type} cache for user ${firebaseUserId}`);
    } catch (error) {
      console.warn('Error invalidating cache (non-critical):', error);
      // Cache invalidation failure is non-critical
    }
  }

  /**
   * Set up background sync (placeholder for future implementation)
   */
  static async setupBackgroundSync(firebaseUserId: string, snaptradeUserId: string, userSecret: string) {
    // This would implement periodic cache updates
    // Could use Firebase Cloud Functions with scheduled triggers
    console.log('📅 Background sync setup (placeholder)');
  }

  // Private helper methods

  private static async getCachedData<T>(cacheKey: string, maxAge: number): Promise<T | null> {
    try {
      if (!db) {
        console.warn('Firestore not initialized, skipping cache read');
        return null;
      }
      
      const [userId, ...pathParts] = cacheKey.split('/').slice(1); // Remove 'snaptrade_users' prefix
      const fieldPath = pathParts.join('_'); // Convert path to field name
      
      const cacheDocRef = doc(db, 'cache', userId);
      const cacheDoc = await getDoc(cacheDocRef);
      
      if (!cacheDoc.exists()) {
        return null;
      }
      
      const cacheEntry = cacheDoc.data()?.[fieldPath] as CacheEntry<T> | undefined;
      
      if (!cacheEntry) {
        return null;
      }
      
      const now = Date.now();
      const isExpired = (now - cacheEntry.lastUpdated) > maxAge;
      
      if (isExpired) {
        console.log('⏰ Cache expired for', cacheKey);
        return null;
      }
      
      return cacheEntry.data;
    } catch (error) {
      console.warn('Error reading cache (non-critical):', error);
      // Return null instead of crashing - cache failures shouldn't break the app
      return null;
    }
  }

  private static async setCachedData<T>(cacheKey: string, data: T, ttl: number): Promise<void> {
    try {
      const [userId, ...pathParts] = cacheKey.split('/').slice(1); // Remove 'snaptrade_users' prefix
      const fieldPath = pathParts.join('_'); // Convert path to field name
      
      const cacheEntry: CacheEntry<T> = {
        data,
        lastUpdated: Date.now(),
        ttl
      };
      
      if (!db) {
        console.warn('Firestore not initialized, skipping cache write');
        return;
      }
      
      const cacheDocRef = doc(db, 'cache', userId);
      await setDoc(cacheDocRef, {
        [fieldPath]: cacheEntry
      }, { merge: true });
      
      console.log('💾 Cached data for', cacheKey);
    } catch (error) {
      console.warn('Error setting cache (non-critical):', error);
      // Don't throw - cache failures shouldn't break the app
      // This is non-critical as the app can work without caching
    }
  }

  private static async getStaleData<T>(cacheKey: string): Promise<T | null> {
    try {
      if (!db) {
        console.warn('Firestore not initialized, skipping stale cache read');
        return null;
      }
      
      const [userId, ...pathParts] = cacheKey.split('/').slice(1);
      const fieldPath = pathParts.join('_');
      
      const cacheDocRef = doc(db, 'cache', userId);
      const cacheDoc = await getDoc(cacheDocRef);
      const cacheEntry = cacheDoc.data()?.[fieldPath] as CacheEntry<T> | undefined;
      
      return cacheEntry?.data || null;
    } catch (error) {
      console.warn('Error reading stale cache (non-critical):', error);
      return null;
    }
  }
}
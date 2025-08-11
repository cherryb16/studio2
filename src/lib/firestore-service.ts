// High-performance Firestore service for trading data
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit as limitQuery,
  onSnapshot,
  writeBatch,
  Timestamp,
  DocumentSnapshot,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  FirestorePosition, 
  FirestoreTrade, 
  FirestorePortfolioSummary,
  TradeStatsCache,
  COLLECTIONS,
  QueryFilters 
} from './firestore-schema';

// ==================== POSITION SERVICES ====================

export class PositionService {
  static async getUserPositions(userId: string, options: { limit?: number; type?: 'options' | 'equities' } = {}) {
    const positions: FirestorePosition[] = [];
    
    // Query both options and equities collections
    const collections = options.type === 'options' ? [COLLECTIONS.POSITIONS_OPTIONS] :
                       options.type === 'equities' ? [COLLECTIONS.POSITIONS_EQUITIES] :
                       [COLLECTIONS.POSITIONS_OPTIONS, COLLECTIONS.POSITIONS_EQUITIES];
    
    for (const collectionName of collections) {
      const q = query(
        collection(db, COLLECTIONS.SNAPTRADE_USERS, userId, collectionName),
        orderBy('marketValue', 'desc'),
        ...(options.limit ? [limitQuery(options.limit)] : [])
      );
      
      const snapshot = await getDocs(q);
      const subPositions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestorePosition));
      positions.push(...subPositions);
    }
    
    // Sort by market value and apply limit if specified
    positions.sort((a, b) => b.marketValue - a.marketValue);
    return options.limit ? positions.slice(0, options.limit) : positions;
  }

  static async getTopPositions(userId: string, limit = 10) {
    const positions: FirestorePosition[] = [];
    
    // Get from both options and equities using simplified structure
    const [optionsSnapshot, equitiesSnapshot] = await Promise.all([
      getDocs(query(
        collection(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.POSITIONS_OPTIONS),
        orderBy('marketValue', 'desc'),
        limitQuery(limit)
      )),
      getDocs(query(
        collection(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.POSITIONS_EQUITIES),
        orderBy('marketValue', 'desc'),
        limitQuery(limit)
      ))
    ]);
    
    const options = optionsSnapshot.docs.map(doc => {
      const data = doc.data() as FirestorePosition;
      console.log(`Reading option position: ${doc.id}, symbol type: ${typeof data.symbol}`, data.symbol);
      return data;
    });
    const equities = equitiesSnapshot.docs.map(doc => {
      const data = doc.data() as FirestorePosition;
      console.log(`Reading equity position: ${doc.id}, symbol type: ${typeof data.symbol}`, data.symbol);
      return data;
    });
    
    // Combine and sort by market value, then take top N
    const allPositions = [...options, ...equities];
    allPositions.sort((a, b) => b.marketValue - a.marketValue);
    
    return allPositions.slice(0, limit);
  }

  static async syncPosition(position: FirestorePosition) {
    const collectionName = position.isOption ? COLLECTIONS.POSITIONS_OPTIONS : COLLECTIONS.POSITIONS_EQUITIES;
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, position.userId, collectionName, position.id);
    await setDoc(docRef, {
      ...position,
      updatedAt: Timestamp.now()
    });
  }

  static async batchSyncPositions(positions: FirestorePosition[]) {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    
    positions.forEach(position => {
      const collectionName = position.isOption ? COLLECTIONS.POSITIONS_OPTIONS : COLLECTIONS.POSITIONS_EQUITIES;
      const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, position.userId, collectionName, position.id);
      batch.set(docRef, { ...position, updatedAt: now });
    });
    
    await batch.commit();
  }


  // Real-time listener for positions - supports nested collections
  static subscribeToUserPositions(
    userId: string, 
    callback: (positions: FirestorePosition[]) => void,
    options: { limit?: number; type?: 'options' | 'equities' } = {}
  ) {
    const positions: FirestorePosition[] = [];
    const unsubscribes: (() => void)[] = [];
    
    const collections = options.type === 'options' ? [COLLECTIONS.POSITIONS_OPTIONS] :
                       options.type === 'equities' ? [COLLECTIONS.POSITIONS_EQUITIES] :
                       [COLLECTIONS.POSITIONS_OPTIONS, COLLECTIONS.POSITIONS_EQUITIES];
    
    collections.forEach(collectionName => {
      const q = query(
        collection(db, COLLECTIONS.SNAPTRADE_USERS, userId, collectionName),
        orderBy('updatedAt', 'desc'),
        ...(options.limit ? [limitQuery(options.limit)] : [])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const subPositions = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as FirestorePosition));
        
        // Update positions array and call callback
        positions.length = 0; // Clear array
        positions.push(...subPositions);
        
        // Sort by market value
        positions.sort((a, b) => b.marketValue - a.marketValue);
        callback(options.limit ? positions.slice(0, options.limit) : positions);
      });
      
      unsubscribes.push(unsubscribe);
    });

    // Return function to unsubscribe from all listeners
    return () => unsubscribes.forEach(unsub => unsub());
  }
}

// ==================== TRADE SERVICES ====================

export class TradeService {
  static async getUserTrades(userId: string, options: QueryFilters = {}) {
    let q = query(
      collection(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.TRADES),
      orderBy('executedAt', 'desc')
    );

    if (options.symbol) {
      q = query(q, where('symbol', '==', options.symbol));
    }
    
    if (options.limit) {
      q = query(q, limitQuery(options.limit));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreTrade));
  }

  static async getRecentTrades(userId: string, days = 30, limit = 100) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const q = query(
      collection(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.TRADES),
      where('executedAt', '>=', Timestamp.fromDate(cutoffDate)),
      orderBy('executedAt', 'desc'),
      limitQuery(limit)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as FirestoreTrade);
  }

  static async syncTrade(trade: FirestoreTrade) {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, trade.userId, COLLECTIONS.TRADES, trade.id);
    await setDoc(docRef, {
      ...trade,
      updatedAt: Timestamp.now()
    });
  }

  static async batchSyncTrades(trades: FirestoreTrade[]) {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    
    trades.forEach(trade => {
      const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, trade.userId, COLLECTIONS.TRADES, trade.id);
      batch.set(docRef, { ...trade, updatedAt: now });
    });
    
    await batch.commit();
  }

}

// ==================== PORTFOLIO SERVICES ====================

export class PortfolioService {
  static async getPortfolioSummary(userId: string): Promise<FirestorePortfolioSummary | null> {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.METRICS, 'portfolio_summary');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as FirestorePortfolioSummary;
    }
    return null;
  }

  static async updatePortfolioSummary(summary: FirestorePortfolioSummary) {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, summary.userId, COLLECTIONS.METRICS, 'portfolio_summary');
    await setDoc(docRef, {
      ...summary,
      updatedAt: Timestamp.now()
    });
  }


  // Real-time listener for portfolio summary
  static subscribeToPortfolioSummary(
    userId: string, 
    callback: (summary: FirestorePortfolioSummary | null) => void
  ) {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.METRICS, 'portfolio_summary');
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as FirestorePortfolioSummary);
      } else {
        callback(null);
      }
    });
  }
}

// ==================== ANALYTICS SERVICES ====================

export class AnalyticsService {
  // Fast cached analytics queries
  static async getTradeStats(userId: string, period = 'all'): Promise<TradeStatsCache | null> {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.METRICS, `trade_stats_${period}`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as TradeStatsCache;
    }
    return null;
  }

  static async updateTradeStats(stats: TradeStatsCache) {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, stats.userId, COLLECTIONS.METRICS, `trade_stats_${stats.period}`);
    await setDoc(docRef, {
      ...stats,
      updatedAt: Timestamp.now()
    });
  }

  // Calculate and cache trade statistics
  static async calculateAndCacheTradeStats(userId: string, period = 'all') {
    // Get trades for period
    let tradesQuery = query(
      collection(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.TRADES),
      where('status', '==', 'filled')
    );

    if (period !== 'all') {
      const cutoffDate = new Date();
      switch (period) {
        case 'day': cutoffDate.setDate(cutoffDate.getDate() - 1); break;
        case 'week': cutoffDate.setDate(cutoffDate.getDate() - 7); break;
        case 'month': cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
        case 'year': cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); break;
      }
      tradesQuery = query(tradesQuery, where('executedAt', '>=', Timestamp.fromDate(cutoffDate)));
    }

    const snapshot = await getDocs(tradesQuery);
    const trades = snapshot.docs.map(doc => doc.data() as FirestoreTrade);
    
    // Calculate stats
    const closedTrades = trades.filter(t => t.realizedPnL !== undefined);
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => (t.realizedPnL || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realizedPnL || 0) < 0);
    
    const totalRealizedPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0));
    
    const stats: TradeStatsCache = {
      userId,
      period,
      totalTrades,
      winRate: totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : 0,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      totalRealizedPnL,
      updatedAt: Timestamp.now()
    };

    await this.updateTradeStats(stats);
    return stats;
  }
}

// ==================== SYNC SERVICES ====================

export class SyncService {
  // Sync from SnapTrade to Firestore
  static async syncFromSnapTrade(userId: string, snaptradeData: any) {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Sync positions
    if (snaptradeData.positions) {
      for (const pos of snaptradeData.positions) {
        const position: FirestorePosition = {
          id: `${userId}_${pos.symbol}_${pos.account?.id || 'default'}`,
          userId,
          symbol: pos.symbol?.symbol || pos.symbol,
          accountId: pos.account?.id || 'default',
          units: pos.units || 0,
          averagePrice: pos.average_purchase_price || 0,
          currentPrice: pos.price || 0,
          marketValue: (pos.units || 0) * (pos.price || 0),
          unrealizedPnL: pos.unrealized_pnl || 0,
          unrealizedPnLPercent: pos.unrealized_pnl_percent || 0,
          instrumentType: pos.instrument?.type || 'stock',
          isOption: pos.instrument?.type === 'option',
          optionDetails: pos.instrument?.type === 'option' ? {
            strike: pos.instrument?.strike_price || 0,
            expiration: pos.instrument?.expiration_date || '',
            type: pos.instrument?.option_type || 'call'
          } : undefined,
          openedAt: now, // You might want to get this from trade history
          updatedAt: now,
          status: 'open'
        };

        const docRef = doc(db, COLLECTIONS.POSITIONS, position.id);
        batch.set(docRef, position);
      }
    }

    await batch.commit();
  }

  // Full refresh from external data
  static async fullRefresh(userId: string) {
    // This would integrate with your existing SnapTrade sync logic
    // but write to Firestore instead of BigQuery
    console.log(`Starting full refresh for user ${userId}`);
    
    // 1. Fetch from SnapTrade
    // 2. Transform to Firestore format
    // 3. Batch write to Firestore
    // 4. Update analytics cache
  }
}
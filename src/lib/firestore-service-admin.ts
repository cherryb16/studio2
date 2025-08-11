// Server-side Firestore service using Firebase Admin SDK
import { db as adminDb } from './firebase-admin';
import { 
  FirestorePosition, 
  FirestoreTrade, 
  COLLECTIONS
} from './firestore-schema';

// Server-side compatible interfaces (using Date instead of Timestamp)
export interface ServerFirestorePortfolioSummary {
  id: string;
  userId: string;
  
  totalValue: number;
  totalCash: number;
  totalSecurities: number;
  dayChange: number;
  dayChangePercent: number;
  
  totalReturn: number;
  totalReturnPercent: number;
  realizedPnL: number;
  unrealizedPnL: number;
  
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  
  lastSyncAt: Date;
  updatedAt: Date;
}

export interface ServerFirestorePosition extends Omit<FirestorePosition, 'openedAt' | 'updatedAt'> {
  openedAt: Date;
  updatedAt: Date;
}

export interface ServerFirestoreTrade extends Omit<FirestoreTrade, 'executedAt' | 'updatedAt'> {
  executedAt: Date;
  updatedAt: Date;
}

// ==================== POSITION SERVICES (SERVER-SIDE) ====================

export class PositionServiceAdmin {
  static async batchSyncPositions(positions: ServerFirestorePosition[]) {
    // Use Admin SDK for server-side operations
    const batch = adminDb.batch();
    const now = new Date();
    
    positions.forEach(position => {
      const collectionName = position.isOption ? COLLECTIONS.POSITIONS_OPTIONS : COLLECTIONS.POSITIONS_EQUITIES;
      const docRef = adminDb.collection(COLLECTIONS.SNAPTRADE_USERS)
        .doc(position.userId)
        .collection(collectionName)
        .doc(position.id);
      
      // Filter out undefined values to avoid Firestore errors
      const cleanPosition = Object.fromEntries(
        Object.entries({ ...position, updatedAt: now }).filter(([_, value]) => value !== undefined)
      );
      
      batch.set(docRef, cleanPosition);
    });
    
    await batch.commit();
  }
}

// ==================== TRADE SERVICES (SERVER-SIDE) ====================

export class TradeServiceAdmin {
  static async batchSyncTrades(trades: ServerFirestoreTrade[]) {
    // Use Admin SDK for server-side operations
    const batch = adminDb.batch();
    const now = new Date();
    
    trades.forEach(trade => {
      const docRef = adminDb.collection(COLLECTIONS.SNAPTRADE_USERS)
        .doc(trade.userId)
        .collection(COLLECTIONS.TRADES)
        .doc(trade.id);
      
      // Filter out undefined values to avoid Firestore errors
      const cleanTrade = Object.fromEntries(
        Object.entries({ ...trade, updatedAt: now }).filter(([_, value]) => value !== undefined)
      );
      
      batch.set(docRef, cleanTrade);
    });
    
    await batch.commit();
  }
}

// ==================== PORTFOLIO SERVICES (SERVER-SIDE) ====================

export class PortfolioServiceAdmin {
  static async updatePortfolioSummary(summary: ServerFirestorePortfolioSummary) {
    // Use Admin SDK for server-side operations
    const docRef = adminDb.collection(COLLECTIONS.SNAPTRADE_USERS)
      .doc(summary.userId)
      .collection(COLLECTIONS.METRICS)
      .doc('portfolio_summary');
    await docRef.set({
      ...summary,
      updatedAt: new Date()
    });
  }
}

// ==================== ANALYTICS SERVICES (SERVER-SIDE) ====================

export class AnalyticsServiceAdmin {
  static async updateTradeStats(stats: any) {
    const docRef = adminDb.collection(COLLECTIONS.SNAPTRADE_USERS)
      .doc(stats.userId)
      .collection(COLLECTIONS.METRICS)
      .doc(`trade_stats_${stats.period}`);
    await docRef.set({
      ...stats,
      updatedAt: new Date()
    });
  }

  // Calculate and cache trade statistics using Admin SDK
  static async calculateAndCacheTradeStats(userId: string, period = 'all') {
    // Get trades for period using Admin SDK
    let tradesRef = adminDb.collection(COLLECTIONS.SNAPTRADE_USERS)
      .doc(userId)
      .collection(COLLECTIONS.TRADES)
      .where('status', '==', 'filled');

    if (period !== 'all') {
      const cutoffDate = new Date();
      switch (period) {
        case 'day': cutoffDate.setDate(cutoffDate.getDate() - 1); break;
        case 'week': cutoffDate.setDate(cutoffDate.getDate() - 7); break;
        case 'month': cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
        case 'year': cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); break;
      }
      tradesRef = tradesRef.where('executedAt', '>=', cutoffDate) as any;
    }

    const snapshot = await tradesRef.get();
    const trades = snapshot.docs.map(doc => doc.data());
    
    // Calculate stats
    const closedTrades = trades.filter((t: any) => t.realizedPnL !== undefined);
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter((t: any) => (t.realizedPnL || 0) > 0);
    const losingTrades = closedTrades.filter((t: any) => (t.realizedPnL || 0) < 0);
    
    const totalRealizedPnL = closedTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);
    const totalWins = winningTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0));
    
    const stats = {
      userId,
      period,
      totalTrades,
      winRate: totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : 0,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      totalRealizedPnL,
      updatedAt: new Date()
    };

    await this.updateTradeStats(stats);
    return stats;
  }
}
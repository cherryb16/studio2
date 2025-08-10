// Direct SnapTrade to Firestore sync - eliminates API calls on every page load
import { Timestamp } from 'firebase/firestore';
import { getAllPositions, getUserHoldings } from '@/app/actions/data-sources/snaptrade/positions';
import { getEnhancedTradeActivities } from '@/app/actions/snaptrade-trades-enhanced';
import { 
  PositionService, 
  TradeService, 
  PortfolioService, 
  AnalyticsService 
} from './firestore-service';
import { 
  FirestorePosition, 
  FirestoreTrade, 
  FirestorePortfolioSummary 
} from './firestore-schema';

interface SnapTradeCredentials {
  userId: string;
  snaptradeUserId: string;
  userSecret: string;
}

export class SnapTradeFirestoreSync {
  
  // ==================== MAIN SYNC METHODS ====================
  
  static async fullSync(credentials: SnapTradeCredentials) {
    console.log(`Starting full sync for user ${credentials.userId}`);
    
    try {
      // Run all syncs in parallel for speed
      const [positions, trades, holdings] = await Promise.all([
        this.syncPositions(credentials),
        this.syncTrades(credentials),
        this.syncPortfolioSummary(credentials)
      ]);

      // Update analytics cache after data sync
      await this.updateAnalyticsCache(credentials.userId);

      console.log(`Full sync completed: ${positions} positions, ${trades} trades`);
      return { positions, trades, success: true };
      
    } catch (error) {
      console.error('Full sync failed:', error);
      return { error: error.message, success: false };
    }
  }

  static async quickSync(credentials: SnapTradeCredentials) {
    // Only sync positions and portfolio summary (faster for frequent updates)
    try {
      const [positions] = await Promise.all([
        this.syncPositions(credentials),
        this.syncPortfolioSummary(credentials)
      ]);

      console.log(`Quick sync completed: ${positions} positions`);
      return { positions, success: true };
      
    } catch (error) {
      console.error('Quick sync failed:', error);
      return { error: error.message, success: false };
    }
  }

  // ==================== POSITION SYNC ====================
  
  static async syncPositions(credentials: SnapTradeCredentials): Promise<number> {
    const positions = await getAllPositions(
      credentials.snaptradeUserId,
      credentials.userSecret
    );

    if ('error' in positions) {
      throw new Error(`Failed to fetch positions: ${positions.error}`);
    }

    const firestorePositions: FirestorePosition[] = positions.map(pos => {
      const marketValue = (pos.units || 0) * (pos.price || 0);
      const unrealizedPnL = pos.unrealized_pnl || 0;
      const isOption = pos.instrument?.type === 'option';
      
      const basePosition: any = {
        id: this.generatePositionId(credentials.userId, pos),
        userId: credentials.userId,
        symbol: typeof pos.symbol === 'string' ? pos.symbol : (pos.symbol?.symbol || pos.symbol?.raw_symbol || 'UNKNOWN'),
        accountId: pos.account?.id || 'default',
        
        units: pos.units || 0,
        averagePrice: pos.average_purchase_price || 0,
        currentPrice: pos.price || 0,
        marketValue,
        unrealizedPnL,
        unrealizedPnLPercent: marketValue > 0 ? (unrealizedPnL / marketValue) * 100 : 0,
        
        instrumentType: this.getInstrumentType(pos),
        isOption,
        
        openedAt: Timestamp.fromDate(new Date()), // Would need trade history to get actual date
        updatedAt: Timestamp.fromDate(new Date()),
        status: 'open'
      };

      // Only add optionDetails if it's actually an option (avoid undefined)
      if (isOption) {
        basePosition.optionDetails = {
          strike: pos.instrument?.strike_price || 0,
          expiration: pos.instrument?.expiration_date || '',
          type: pos.instrument?.option_type || 'call'
        };
      }

      return basePosition as FirestorePosition;
    });

    // Batch sync for performance
    if (firestorePositions.length > 0) {
      await PositionService.batchSyncPositions(firestorePositions);
    }

    return firestorePositions.length;
  }

  // ==================== TRADE SYNC ====================
  
  static async syncTrades(credentials: SnapTradeCredentials, daysBack = 90): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const tradesResult = await getEnhancedTradeActivities(
      credentials.snaptradeUserId,
      credentials.userSecret,
      startDate
    );

    if ('error' in tradesResult) {
      throw new Error(`Failed to fetch trades: ${tradesResult.error}`);
    }

    const firestoreTrades: FirestoreTrade[] = tradesResult.map(trade => {
      const baseTrade: any = {
        id: trade.id || `${credentials.userId}_${Date.now()}_${Math.random()}`,
        userId: credentials.userId,
        accountId: trade.accountId || 'default',
        positionId: this.generatePositionId(credentials.userId, trade),
        
        symbol: trade.symbol,
        action: trade.action,
        units: trade.quantity,
        price: trade.price,
        totalValue: trade.totalValue,
        fee: trade.commission || 0,
        
        instrumentType: this.getInstrumentType(trade),
        isOption: trade.isOption || false,
        
        realizedPnL: trade.realizedPnL,
        holdingPeriod: trade.holdingPeriod,
        
        executedAt: Timestamp.fromDate(trade.executedAt),
        tradeDate: trade.tradeDate,
        currency: trade.currency || 'USD',
        status: 'filled',
        updatedAt: Timestamp.fromDate(new Date())
      };

      // Only add optionDetails if it exists and is not empty
      if (trade.optionDetails) {
        baseTrade.optionDetails = trade.optionDetails;
      }

      return baseTrade as FirestoreTrade;
    });

    // Batch sync for performance
    if (firestoreTrades.length > 0) {
      await TradeService.batchSyncTrades(firestoreTrades);
    }

    return firestoreTrades.length;
  }

  // ==================== PORTFOLIO SUMMARY SYNC ====================
  
  static async syncPortfolioSummary(credentials: SnapTradeCredentials) {
    const holdings = await getUserHoldings(
      credentials.snaptradeUserId,
      credentials.userSecret
    );

    if ('error' in holdings) {
      throw new Error(`Failed to fetch holdings: ${holdings.error}`);
    }

    // Calculate summary metrics
    const totalValue = holdings.total_value?.value || 0;
    const totalCash = holdings.balances?.reduce((sum, b) => sum + (b.cash || 0), 0) || 0;
    const totalSecurities = totalValue - totalCash;
    
    // Calculate unrealized P&L from positions
    const unrealizedPnL = [
      ...(holdings.positions || []),
      ...(holdings.option_positions || [])
    ].reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0);

    const summary: FirestorePortfolioSummary = {
      id: credentials.userId,
      userId: credentials.userId,
      
      totalValue,
      totalCash,
      totalSecurities,
      dayChange: 0, // Would need historical data
      dayChangePercent: 0,
      
      totalReturn: 0, // Would calculate from trades
      totalReturnPercent: 0,
      realizedPnL: 0, // Would calculate from closed trades
      unrealizedPnL,
      
      // These will be updated by analytics cache
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      
      lastSyncAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    };

    await PortfolioService.updatePortfolioSummary(summary);
    return summary;
  }

  // ==================== ANALYTICS CACHE UPDATE ====================
  
  static async updateAnalyticsCache(userId: string) {
    // Update trade stats for different periods
    const periods = ['day', 'week', 'month', 'year', 'all'];
    
    await Promise.all(
      periods.map(period => 
        AnalyticsService.calculateAndCacheTradeStats(userId, period)
      )
    );
  }

  // ==================== HELPER METHODS ====================
  
  static generatePositionId(userId: string, position: any): string {
    // Safely extract symbol string
    let symbol = 'UNKNOWN';
    if (typeof position.symbol === 'string') {
      symbol = position.symbol;
    } else if (position.symbol?.symbol) {
      symbol = position.symbol.symbol;
    } else if (position.symbol?.raw_symbol) {
      symbol = position.symbol.raw_symbol;
    }
    
    const accountId = position.account?.id || position.accountId || 'default';
    
    if (position.instrument?.type === 'option' || position.isOption) {
      const strike = position.instrument?.strike_price || position.optionDetails?.strike || 0;
      const expiration = position.instrument?.expiration_date || position.optionDetails?.expiration || '';
      const type = position.instrument?.option_type || position.optionDetails?.type || 'call';
      return `${userId}_${symbol}_${strike}_${expiration}_${type}_${accountId}`;
    }
    
    return `${userId}_${symbol}_${accountId}`;
  }
  
  static getInstrumentType(item: any): 'stock' | 'option' | 'etf' | 'crypto' {
    if (item.instrument?.type) {
      const type = item.instrument.type.toLowerCase();
      if (type.includes('option')) return 'option';
      if (type.includes('etf')) return 'etf';
      if (type.includes('crypto')) return 'crypto';
    }
    
    if (item.isOption) return 'option';
    return 'stock'; // default
  }
}

// ==================== SYNC SCHEDULING ====================

export class SyncScheduler {
  static async scheduleUserSync(credentials: SnapTradeCredentials) {
    // Quick sync every 5 minutes during market hours
    // Full sync once daily or when manually triggered
    
    const now = new Date();
    const isMarketHours = this.isMarketHours(now);
    
    if (isMarketHours) {
      return await SnapTradeFirestoreSync.quickSync(credentials);
    } else {
      return await SnapTradeFirestoreSync.fullSync(credentials);
    }
  }
  
  static isMarketHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    
    // Monday-Friday, 9:30 AM - 4:00 PM EST (simplified)
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 16;
  }
}
// src/lib/snaptrade-firestore-sync.ts

// Direct SnapTrade to Firestore sync - eliminates API calls on every page load
import { Position, UniversalSymbol } from 'snaptrade-typescript-sdk';
import { getAllPositions, getUserHoldings } from '@/app/actions/data-sources/snaptrade/positions';
import { getEnhancedTradeActivities, EnhancedTradeActivity } from '@/app/actions/snaptrade-trades-enhanced';
import { 
  PositionServiceAdmin, 
  TradeServiceAdmin, 
  PortfolioServiceAdmin, 
  AnalyticsServiceAdmin,
  ServerFirestorePosition,
  ServerFirestoreTrade,
  ServerFirestorePortfolioSummary
} from './firestore-service-admin';

interface SnapTradeCredentials {
  userId: string;
  snaptradeUserId: string;
  userSecret: string;
}

// Helper type for objects that can be treated like a position for ID generation
type PositionLike = Position | EnhancedTradeActivity;

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

      // Skip analytics cache for now (requires Firestore indexes)
      // await this.updateAnalyticsCache(credentials.userId);

      console.log(`Full sync completed: ${positions} positions, ${trades} trades`);
      return { positions, trades, success: true };
      
    } catch (error) {
      console.error('Full sync failed:', error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { error: message, success: false };
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
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { error: message, success: false };
    }
  }

  // ==================== POSITION SYNC ====================
  
  static async syncPositions(credentials: SnapTradeCredentials): Promise<number> {
    console.log('Fetching positions from SnapTrade...');
    const positions = await getAllPositions(
      credentials.snaptradeUserId,
      credentials.userSecret
    );

    if ('error' in positions) {
      console.error('Failed to fetch positions:', positions.error);
      throw new Error(`Failed to fetch positions: ${positions.error}`);
    }

    console.log(`Fetched ${positions.length} positions from SnapTrade`);

    const firestorePositions: ServerFirestorePosition[] = positions.map((pos: Position) => {
      const marketValue = (pos.units || 0) * (pos.price || 0);
      const unrealizedPnL = pos.unrealized_pnl || 0;
      const isOption = pos.instrument?.type === 'option';
      
      // Extract symbol based on SnapTrade API structure
      let symbolString = 'UNKNOWN';
      if (typeof pos.symbol === 'string') {
        symbolString = pos.symbol;
      } else if (pos.symbol && typeof pos.symbol === 'object') {
        // Handle nested symbol structure: pos.symbol.symbol.symbol for equities
        const symbolObj = pos.symbol as any;
        if (symbolObj.symbol && typeof symbolObj.symbol === 'object' && symbolObj.symbol.symbol) {
          symbolString = symbolObj.symbol.symbol;
        } else if (symbolObj.symbol && typeof symbolObj.symbol === 'string') {
          symbolString = symbolObj.symbol;
        } else if (symbolObj.raw_symbol) {
          symbolString = symbolObj.raw_symbol;
        }
      }

      const basePosition: any = {
        id: this.generatePositionId(credentials.userId, pos),
        userId: credentials.userId,
        symbol: symbolString,
        accountId: pos.account?.id || 'default',
        
        units: pos.units || 0,
        averagePrice: pos.average_purchase_price || 0,
        currentPrice: pos.price || 0,
        marketValue,
        unrealizedPnL,
        unrealizedPnLPercent: marketValue > 0 ? (unrealizedPnL / marketValue) * 100 : 0,
        
        instrumentType: this.getInstrumentType(pos),
        isOption,
        
        openedAt: new Date(), // Would need trade history to get actual date
        updatedAt: new Date(),
        status: 'open'
      };

      if (isOption) {
        basePosition.optionDetails = {
          strike: pos.instrument?.strike_price || 0,
          expiration: pos.instrument?.expiration_date || '',
          type: pos.instrument?.option_type || 'call'
        };
      }

      return basePosition as ServerFirestorePosition;
    });

    console.log(`Transformed ${firestorePositions.length} positions for Firestore`);
    
    // Debug: Log sample positions to see the data structure
    if (firestorePositions.length > 0) {
      console.log('Sample position data:', JSON.stringify(firestorePositions.slice(0, 3), null, 2));
      console.log('Position breakdowns:');
      const optionsCount = firestorePositions.filter(p => p.isOption).length;
      const equitiesCount = firestorePositions.filter(p => !p.isOption).length;
      console.log(`- Options positions: ${optionsCount}`);
      console.log(`- Equities positions: ${equitiesCount}`);
      
      console.log('Saving positions to Firestore...');
      await PositionServiceAdmin.batchSyncPositions(firestorePositions);
      console.log('Positions saved successfully');
    } else {
      console.log('No positions to save');
    }

    return firestorePositions.length;
  }

  // ==================== TRADE SYNC ====================
  
  static async syncTrades(credentials: SnapTradeCredentials, daysBack = 90): Promise<number> {
    console.log(`Fetching trades from SnapTrade (last ${daysBack} days)...`);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const tradesResult = await getEnhancedTradeActivities(
      credentials.snaptradeUserId,
      credentials.userSecret,
      startDate
    );

    if ('error' in tradesResult) {
      console.error('Failed to fetch trades:', tradesResult.error);
      throw new Error(`Failed to fetch trades: ${tradesResult.error}`);
    }

    console.log(`Fetched ${tradesResult.length} trades from SnapTrade`);

    const firestoreTrades: ServerFirestoreTrade[] = tradesResult.map((trade: EnhancedTradeActivity) => {
      // Extract symbol based on SnapTrade API structure
      const tradeSymbol = trade.symbol;
      let symbolString: string = 'UNKNOWN';
      if (typeof tradeSymbol === 'string') {
        symbolString = tradeSymbol;
      } else if (tradeSymbol && typeof tradeSymbol === 'object') {
        // Handle nested symbol structure: trade.symbol.symbol.symbol for equities
        const symbolObj = tradeSymbol as any;
        if (symbolObj.symbol && typeof symbolObj.symbol === 'object' && symbolObj.symbol.symbol) {
          symbolString = symbolObj.symbol.symbol;
        } else if (symbolObj.symbol && typeof symbolObj.symbol === 'string') {
          symbolString = symbolObj.symbol;
        } else if (symbolObj.raw_symbol) {
          symbolString = symbolObj.raw_symbol;
        }
      }
      
      const baseTrade: any = {
        id: trade.id || `${credentials.userId}_${Date.now()}_${Math.random()}`,
        userId: credentials.userId,
        accountId: trade.accountId || 'default',
        positionId: this.generatePositionId(credentials.userId, trade),
        symbol: symbolString,
        action: trade.action,
        units: trade.quantity,
        price: trade.price,
        totalValue: trade.totalValue,
        fee: trade.commission || 0,
        instrumentType: this.getInstrumentType(trade),
        isOption: trade.isOption || false,
        realizedPnL: trade.realizedPnL,
        holdingPeriod: trade.holdingPeriod,
        executedAt: trade.executedAt,
        tradeDate: trade.tradeDate,
        currency: trade.currency || 'USD',
        status: 'filled',
        updatedAt: new Date()
      };

      if (trade.optionDetails) {
        baseTrade.optionDetails = trade.optionDetails;
      }

      return baseTrade as ServerFirestoreTrade;
    });

    console.log(`Transformed ${firestoreTrades.length} trades for Firestore`);

    if (firestoreTrades.length > 0) {
      console.log('Saving trades to Firestore...');
      await TradeServiceAdmin.batchSyncTrades(firestoreTrades);
      console.log('Trades saved successfully');
    } else {
      console.log('No trades to save');
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

    const totalValue = holdings.total_value?.value || 0;
    const totalCash = holdings.balances?.reduce((sum, b) => sum + (b.cash || 0), 0) || 0;
    const totalSecurities = totalValue - totalCash;
    
    const unrealizedPnL = [
      ...(holdings.positions || []),
      ...(holdings.option_positions || [])
    ].reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0);

    const summary: ServerFirestorePortfolioSummary = {
      id: credentials.userId,
      userId: credentials.userId,
      
      totalValue,
      totalCash,
      totalSecurities,
      dayChange: 0,
      dayChangePercent: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      realizedPnL: 0,
      unrealizedPnL,
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      
      lastSyncAt: new Date(),
      updatedAt: new Date()
    };

    await PortfolioServiceAdmin.updatePortfolioSummary(summary);
    return summary;
  }

  // ==================== ANALYTICS CACHE UPDATE ====================
  
  static async updateAnalyticsCache(userId: string) {
    const periods = ['day', 'week', 'month', 'year', 'all'];
    
    await Promise.all(
      periods.map(period => 
        AnalyticsServiceAdmin.calculateAndCacheTradeStats(userId, period)
      )
    );
  }

  // ==================== HELPER METHODS ====================
  
  static generatePositionId(userId: string, position: PositionLike): string {
    let symbol: string = 'UNKNOWN';
    const posSymbol = position.symbol;

    if (typeof posSymbol === 'string') {
      symbol = posSymbol;
    } else if (posSymbol && typeof posSymbol === 'object') {
      // Handle nested symbol structure: pos.symbol.symbol.symbol for equities
      const symbolObj = posSymbol as any;
      if (symbolObj.symbol && typeof symbolObj.symbol === 'object' && symbolObj.symbol.symbol) {
        symbol = symbolObj.symbol.symbol;
      } else if (symbolObj.symbol && typeof symbolObj.symbol === 'string') {
        symbol = symbolObj.symbol;
      } else if (symbolObj.raw_symbol) {
        symbol = symbolObj.raw_symbol;
      }
    }
    
    const accountId = (position as any).account?.id || (position as any).accountId || 'default';
    
    if ((position as any).instrument?.type === 'option' || (position as any).isOption) {
      const strike = (position as any).instrument?.strike_price || (position as any).optionDetails?.strike || 0;
      const expiration = (position as any).instrument?.expiration_date || (position as any).optionDetails?.expiration || '';
      const type = (position as any).instrument?.option_type || (position as any).optionDetails?.type || 'call';
      return `${userId}_${symbol}_${strike}_${expiration}_${type}_${accountId}`;
    }
    
    return `${userId}_${symbol}_${accountId}`;
  }
  
  static getInstrumentType(item: PositionLike): 'stock' | 'option' | 'etf' | 'crypto' {
    if ((item as any).instrument?.type) {
      const type = (item as any).instrument.type.toLowerCase();
      if (type.includes('option')) return 'option';
      if (type.includes('etf')) return 'etf';
      if (type.includes('crypto')) return 'crypto';
    }
    
    if ((item as any).isOption) return 'option';
    return 'stock';
  }
}

// ==================== SYNC SCHEDULING ====================

export class SyncScheduler {
  static async scheduleUserSync(credentials: SnapTradeCredentials) {
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
    
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 16;
  }
}

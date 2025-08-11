// Server-only Firestore sync functions using Firebase Admin
'use server';

import { getDb } from '@/lib/firebase-admin';
import { getAllPositions, getUserHoldings } from './data-sources/snaptrade/positions';
import { getEnhancedTradeActivities } from './snaptrade-trades-enhanced';

interface SnapTradeCredentials {
  userId: string;
  snaptradeUserId: string;
  userSecret: string;
}

export async function serverSyncPositions(credentials: SnapTradeCredentials, clearExisting = false): Promise<number> {
  
  const adminDb = getDb();
  
  // Clear existing positions if requested (for full sync)
  if (clearExisting) {
    await clearUserPositions(adminDb, credentials.userId);
  }
  
  const positions = await getAllPositions(
    credentials.snaptradeUserId,
    credentials.userSecret
  );

  if ('error' in positions) {
    throw new Error(`Failed to fetch positions: ${positions.error}`);
  }

  const batch = adminDb.batch();
  const now = new Date();
  
  // Track position IDs to detect duplicates
  const positionIds = new Set<string>();
  const duplicateIds: string[] = [];

  positions.forEach((pos: any) => {
    // Extract symbol string based on SnapTrade API structure
    let symbol = 'UNKNOWN';
    
    // For options: extract from symbol.option_symbol.underlying_symbol.symbol
    if (pos.symbol?.option_symbol?.underlying_symbol?.symbol) {
      symbol = pos.symbol.option_symbol.underlying_symbol.symbol;
    }
    // For regular positions: extract from symbol.symbol.symbol or symbol.symbol.raw_symbol  
    else if (pos.symbol?.symbol?.symbol) {
      symbol = pos.symbol.symbol.symbol;
    }
    else if (pos.symbol?.symbol?.raw_symbol) {
      symbol = pos.symbol.symbol.raw_symbol;
    }
    // Fallback patterns
    else if (typeof pos.symbol === 'string') {
      symbol = pos.symbol;
    }
    
    const marketValue = (pos.units || 0) * (pos.price || 0);
    const unrealizedPnL = pos.open_pnl || 0; // SnapTrade uses 'open_pnl' not 'unrealized_pnl'
    const isOption = !!pos.symbol?.option_symbol; // Options have option_symbol property
    
    // Generate unique position ID with proper account ID
    const accountId = pos.account?.id || pos.accountId || 'default';
    
    const positionId = isOption ? 
      `${symbol}_${pos.symbol?.option_symbol?.strike_price || 0}_${pos.symbol?.option_symbol?.expiration_date || ''}_${pos.symbol?.option_symbol?.option_type || 'CALL'}_${accountId}` :
      `${symbol}_${accountId}`;

    // Check for duplicate position IDs
    if (positionIds.has(positionId)) {
      duplicateIds.push(positionId);
    } else {
      positionIds.add(positionId);
    }
    
    

    const basePosition: any = {
      id: positionId,
      userId: credentials.userId,
      symbol: typeof symbol === 'string' ? symbol : String(symbol), // Ensure it's always a string
      accountId: pos.account?.id || 'default',
      
      units: pos.units || 0,
      averagePrice: pos.average_purchase_price || 0,
      currentPrice: pos.price || 0,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent: marketValue > 0 ? (unrealizedPnL / marketValue) * 100 : 0,
      
      instrumentType: getInstrumentType(pos),
      isOption,
      
      openedAt: now,
      updatedAt: now,
      status: 'open'
    };

    // Only add optionDetails if it's actually an option
    if (isOption && pos.symbol?.option_symbol) {
      basePosition.optionDetails = {
        strike: pos.symbol.option_symbol.strike_price || 0,
        expiration: pos.symbol.option_symbol.expiration_date || '',
        type: pos.symbol.option_symbol.option_type?.toLowerCase() || 'call'
      };
    }

    // Use simplified structure: snaptrade_users/{userId}/positions_options/{positionId} or snaptrade_users/{userId}/positions_equities/{positionId}
    const collectionName = isOption ? 'positions_options' : 'positions_equities';
    
    const docRef = adminDb
      .collection('snaptrade_users')
      .doc(credentials.userId)
      .collection(collectionName)
      .doc(positionId);
    const cleanedPosition = cleanObject(basePosition);
    batch.set(docRef, cleanedPosition);
  });

  // Count positions by type
  let optionCount = 0;
  let equityCount = 0;
  positions.forEach((pos: any) => {
    if (!!pos.symbol?.option_symbol) {
      optionCount++;
    } else {
      equityCount++;
    }
  });
  

  await batch.commit();
  return positions.length;
}

export async function serverSyncTrades(credentials: SnapTradeCredentials, daysBack = 90, clearExisting = false): Promise<number> {
  const adminDb = getDb();
  
  // Clear existing trades if requested (for full sync)
  if (clearExisting) {
    await clearUserTrades(adminDb, credentials.userId);
  }
  
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

  const batch = adminDb.batch();
  const now = new Date();

  tradesResult.forEach(trade => {
    const baseTrade: any = {
      id: trade.id || `${credentials.userId}_${Date.now()}_${Math.random()}`,
      userId: credentials.userId,
      accountId: trade.accountId || 'default',
      
      symbol: trade.symbol,
      action: trade.action,
      units: trade.quantity,
      price: trade.price,
      totalValue: trade.totalValue,
      fee: trade.commission || 0,
      
      instrumentType: getInstrumentType(trade),
      isOption: trade.isOption || false,
      
      executedAt: trade.executedAt,
      tradeDate: trade.tradeDate,
      currency: trade.currency || 'USD',
      status: 'filled',
      updatedAt: now
    };

    // Only add optional fields if they have values
    if (trade.realizedPnL !== undefined && trade.realizedPnL !== null) {
      baseTrade.realizedPnL = trade.realizedPnL;
    }
    
    if (trade.holdingPeriod !== undefined && trade.holdingPeriod !== null) {
      baseTrade.holdingPeriod = trade.holdingPeriod;
    }

    if (trade.optionDetails) {
      baseTrade.optionDetails = trade.optionDetails;
    }

    const docRef = adminDb
      .collection('snaptrade_users')
      .doc(credentials.userId)
      .collection('trades')
      .doc(baseTrade.id);
    batch.set(docRef, cleanObject(baseTrade));
  });

  await batch.commit();
  return tradesResult.length;
}

export async function serverSyncPortfolioSummary(credentials: SnapTradeCredentials) {
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

  const summary = {
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
    
    lastSyncAt: new Date(),
    updatedAt: new Date()
  };

  const adminDb = getDb();
  const docRef = adminDb
    .collection('snaptrade_users')
    .doc(credentials.userId)
    .collection('metrics')
    .doc('portfolio_summary');
  await docRef.set(cleanObject(summary));
  
  return summary;
}

export async function serverFullSync(credentials: SnapTradeCredentials) {
  try {
    
    // For full sync, clear existing data first, then sync everything
    const [positions, trades] = await Promise.all([
      serverSyncPositions(credentials, true), // true = clear existing positions
      serverSyncTrades(credentials, 90, true), // true = clear existing trades
      serverSyncPortfolioSummary(credentials)
    ]);

    return { positions, trades, success: true };
    
  } catch (error) {
    console.error('Full sync failed:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error', success: false };
  }
}

export async function serverQuickSync(credentials: SnapTradeCredentials) {
  try {
    const [positions] = await Promise.all([
      serverSyncPositions(credentials),
      serverSyncPortfolioSummary(credentials)
    ]);

    return { positions, success: true };
    
  } catch (error) {
    console.error('Quick sync failed:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error', success: false };
  }
}

// Helper function to remove undefined/null values
function cleanObject(obj: any): any {
  const cleaned: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
}

// Helper function to clear all existing positions for a user
async function clearUserPositions(adminDb: any, userId: string) {
  const batch = adminDb.batch();
  
  // Get all existing positions from both collections
  const [optionsSnapshot, equitiesSnapshot] = await Promise.all([
    adminDb.collection('snaptrade_users')
      .doc(userId)
      .collection('positions_options')
      .get(),
    adminDb.collection('snaptrade_users')
      .doc(userId)
      .collection('positions_equities')
      .get()
  ]);
  
  // Add deletions to batch
  optionsSnapshot.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });
  
  equitiesSnapshot.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });
  
  const totalToDelete = optionsSnapshot.size + equitiesSnapshot.size;
  if (totalToDelete > 0) {
    await batch.commit();
  } else {
  }
}

// Helper function to clear all existing trades for a user
async function clearUserTrades(adminDb: any, userId: string) {
  const batch = adminDb.batch();
  
  // Get all existing trades
  const tradesSnapshot = await adminDb.collection('snaptrade_users')
    .doc(userId)
    .collection('trades')
    .get();
  
  // Add deletions to batch
  tradesSnapshot.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });
  
  const totalToDelete = tradesSnapshot.size;
  if (totalToDelete > 0) {
    await batch.commit();
  } else {
  }
}

// Helper function
function getInstrumentType(item: any): 'stock' | 'option' | 'etf' | 'crypto' {
  if (item.instrument?.type) {
    const type = item.instrument.type.toLowerCase();
    if (type.includes('option')) return 'option';
    if (type.includes('etf')) return 'etf';
    if (type.includes('crypto')) return 'crypto';
  }
  
  if (item.isOption) return 'option';
  return 'stock'; // default
}
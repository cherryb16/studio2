// src/app/actions/orchestration/performance-analytics.ts
'use server';

import { getUserHoldings } from '../data-sources/snaptrade/positions';
import { getMultipleUnifiedQuotes } from '../data-sources/market-data/unified-provider';
// Market data APIs removed - performance metrics disabled
import { analyzePerformanceAttribution } from '../core/risk-calculations';

// Extract holdings data for performance calculations
function extractHoldingsForPerformance(holdings: any): Map<string, { units: number; averagePrice: number }> {
  const holdingsMap = new Map<string, { units: number; averagePrice: number }>();
  
  holdings.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol;
    if (symbol && position.units && position.average_purchase_price) {
      holdingsMap.set(symbol, {
        units: position.units,
        averagePrice: position.average_purchase_price
      });
    }
  });

  return holdingsMap;
}

// Real-time performance analysis with Yahoo Finance integration
export async function getRealTimePerformanceAnalysis(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    console.log('Fetching real-time performance data...');
    
    const holdings = await getUserHoldings(snaptradeUserId, userSecret, accountId);
    
    if ('error' in holdings) {
      return holdings;
    }

    // Extract symbols and holdings data
    const symbols = holdings.positions?.map((pos: any) => pos.symbol?.symbol?.symbol).filter(Boolean) || [];
    const holdingsForPerformance = extractHoldingsForPerformance(holdings);

    if (symbols.length === 0) {
      return { error: 'No valid positions found for performance analysis.' };
    }

    console.log(`Analyzing performance for ${symbols.length} symbols...`);

    // Market data APIs disabled - return empty data
    const performanceMetrics = {
      historicalData: [],
      totalValue: 0,
      positions: []
    };
    const quotes = new Map();

    // Calculate performance attribution using internal holdings data
    const performanceAttribution = analyzePerformanceAttribution(holdings as any);

    // Market data APIs disabled - return empty enhanced positions
    const enhancedPositions: any[] = [];

    return {
      portfolio: {
        totalValue: performanceMetrics.totalValue,
        totalCost: 0,
        totalUnrealizedPnL: 0,
        totalReturnPercent: 0
      },
      
      performance: {
        topGainers: [],
        topLosers: [],
        attribution: performanceAttribution
      },
      
      positions: enhancedPositions,
      
      marketData: {
        quotesTimestamp: new Date().toISOString(),
        marketStatus: 'open', // Could be enhanced with real market status
        dataQuality: {
          positionsAnalyzed: enhancedPositions.length,
          quotesRetrieved: quotes.size
        }
      },

      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in real-time performance analysis:', error);
    return { error: 'Failed to analyze real-time performance.' };
  }
}

// Historical performance analysis (placeholder for future enhancement)
export async function getHistoricalPerformanceAnalysis(
  snaptradeUserId: string,
  userSecret: string,
  timeframe: '1M' | '3M' | '6M' | '1Y' | '5Y' = '3M',
  accountId?: string
) {
  try {
    // This would integrate with historical price data
    // For now, return a placeholder structure
    
    const holdings = await getUserHoldings(snaptradeUserId, userSecret, accountId);
    
    if ('error' in holdings) {
      return holdings;
    }

    return {
      timeframe,
      analysis: 'Historical analysis not yet implemented - requires historical price data integration',
      placeholder: true,
      symbols: holdings.positions?.map((pos: any) => pos.symbol?.symbol?.symbol).filter(Boolean) || [],
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in historical performance analysis:', error);
    return { error: 'Failed to analyze historical performance.' };
  }
}
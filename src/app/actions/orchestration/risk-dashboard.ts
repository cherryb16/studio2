// src/app/actions/orchestration/risk-dashboard.ts
'use server';

import { getUserHoldings } from '../data-sources/snaptrade/positions';
import { getSnapTradeAccounts } from '../data-sources/snaptrade/accounts';
// ESG, sector, and dividend data removed to eliminate external API costs
import {
  analyzeTaxLossHarvesting,
  analyzePositionSizing,
  analyzePortfolioCorrelation,
  analyzePerformanceAttribution,
  calculateRiskScore,
  calculateDiversificationScore,
  generateRiskActionItems
} from '../core/risk-calculations';

// Extract symbols from holdings data
function extractSymbolsFromHoldings(holdings: any): string[] {
  const symbols = new Set<string>();
  
  holdings.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol;
    if (symbol) {
      symbols.add(symbol);
    }
  });

  return Array.from(symbols);
}

// Main risk dashboard generator with dynamic data
export async function generateRiskDashboard(
  snaptradeUserId: string, 
  userSecret: string,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
) {
  try {
    console.log('Generating risk dashboard with dynamic data sources...');
    
    const accountsResponse = await getSnapTradeAccounts(snaptradeUserId, userSecret);
    
    if ('error' in accountsResponse || accountsResponse.length === 0) {
      return { error: 'No linked accounts found for user.' };
    }

    // Fetch holdings from all accounts
    let holdings = null;
    let holdingsError = null;

    try {
      const holdingsResponse = await getUserHoldings(snaptradeUserId, userSecret);

      if (!('error' in holdingsResponse) && holdingsResponse.positions && holdingsResponse.positions.length > 0) {
        holdings = holdingsResponse;
      }
    } catch (err) {
      console.log('Error fetching aggregated holdings:', err);
      holdingsError = err;
    }

    if (!holdings) {
      return { 
        error: holdingsError ? 
          `Error fetching holdings: ${holdingsError}` : 
          'No positions found in any connected accounts. Please ensure you have stock/ETF positions in your brokerage account.'
      };
    }

    // Extract symbols from holdings
    const symbols = extractSymbolsFromHoldings(holdings);
    
    if (symbols.length === 0) {
      return { error: 'No valid symbols found in portfolio positions.' };
    }

    console.log(`Fetching dynamic data for ${symbols.length} symbols...`);

    // External data APIs removed - using empty data
    console.log('ESG, sector, and dividend data APIs disabled');

    // Generate risk analysis using only internal SnapTrade data
    const positionSizing = analyzePositionSizing(holdings as any, riskTolerance);
    const performanceAttribution = analyzePerformanceAttribution(holdings as any);
    const taxOptimization = analyzeTaxLossHarvesting(holdings as any);

    return {
      riskSummary: {
        overallRiskScore: calculateRiskScore(holdings as any, positionSizing.violations.length),
        diversificationScore: calculateDiversificationScore(holdings as any),
        concentrationRisk: positionSizing,
        correlationRisk: analyzeCorrelationRisk(holdings)
      },
      
      positionSizing,
      performanceAttribution,
      taxOptimization,
      
      // ESG, sector, and dividend analysis removed
      sectorAnalysis: { allocation: {}, riskLevel: 'moderate', recommendations: [] },
      dividendAnalysis: { avgYield: 0, totalDividends: 0, sustainabilityScore: 0 },
      esgAnalysis: { overall: 50, environmental: 50, social: 50, governance: 50 },
      
      actionItems: generateRiskActionItems(holdings as any, riskTolerance, new Map()),
      
      dataQuality: {
        symbolsAnalyzed: symbols.length,
        sectorsIdentified: 0,
        dividendDataPoints: 0,
        esgScoresAvailable: 0
      },
      
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating risk dashboard:', error);
    
    let errorMessage = 'Failed to generate risk dashboard.';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('Data provided to an operation does not meet requirements')) {
        errorMessage = 'Invalid credentials or data format. Please check your SnapTrade connection.';
      } else if (error.message.includes('importKey')) {
        errorMessage = 'Authentication error with SnapTrade API. Please reconnect your brokerage account.';
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = 'Unauthorized access to SnapTrade API. Please check your credentials.';
      }
    }
    
    return { error: errorMessage };
  }
}

// Simplified correlation risk analysis (can be enhanced with real correlation data)
function analyzeCorrelationRisk(holdings: any) {
  const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'QQQ', 'XLK'];
  const techCount = holdings.positions?.filter((pos: any) => 
    techSymbols.includes(pos.symbol?.symbol?.symbol)
  ).length || 0;
  
  return {
    level: techCount > 3 ? 'high' : techCount > 1 ? 'medium' : 'low',
    techConcentration: techCount,
    recommendation: techCount > 3 ? 'Consider reducing technology sector concentration' : 'Acceptable correlation levels'
  };
}
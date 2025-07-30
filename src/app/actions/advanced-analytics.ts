// src/app/actions/advanced-analytics.ts


import { snaptrade } from './snaptrade-client';

// ==================== SECTOR & INDUSTRY ANALYSIS ====================

interface SectorData {
  sector: string;
  value: number;
  percentage: number;
  positions: Array<{
    symbol: string;
    value: number;
    weight: number;
  }>;
}

export function analyzeSectorAllocation(holdingsData: any): SectorData[] {
  // This would typically require external market data API for sector classification
  // For now, we'll use a basic mapping of common symbols to sectors
  const sectorMap: { [key: string]: string } = {
    'AAPL': 'Technology',
    'MSFT': 'Technology',
    'GOOGL': 'Technology',
    'AMZN': 'Consumer Discretionary',
    'TSLA': 'Consumer Discretionary',
    'JPM': 'Financial Services',
    'JNJ': 'Healthcare',
    'PFE': 'Healthcare',
    'XOM': 'Energy',
    'SPY': 'Broad Market ETF',
    'QQQ': 'Technology ETF',
    'VTI': 'Broad Market ETF'
  };

  const sectorTotals: { [key: string]: { value: number; positions: any[] } } = {};
  const totalPortfolioValue = holdingsData.total_value?.value || 0;

  holdingsData.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol || '';
    const value = (position.units || 0) * (position.price || 0);
    const sector = sectorMap[symbol] || 'Other';

    if (!sectorTotals[sector]) {
      sectorTotals[sector] = { value: 0, positions: [] };
    }

    sectorTotals[sector].value += value;
    sectorTotals[sector].positions.push({
      symbol,
      value,
      weight: totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0
    });
  });

  return Object.entries(sectorTotals).map(([sector, data]) => ({
    sector,
    value: data.value,
    percentage: totalPortfolioValue > 0 ? (data.value / totalPortfolioValue) * 100 : 0,
    positions: data.positions.sort((a, b) => b.value - a.value)
  })).sort((a, b) => b.value - a.value);
}

// ==================== DIVIDEND ANALYSIS ====================

export function calculateDividendMetrics(holdingsData: any) {
  // This would require dividend data from external API
  // Placeholder structure for dividend analysis
  const dividendYieldMap: { [key: string]: number } = {
    'AAPL': 0.5,
    'MSFT': 0.7,
    'JPM': 2.4,
    'JNJ': 2.6,
    'SPY': 1.3,
    'VTI': 1.4
  };

  let totalDividendIncome = 0;
  let weightedDividendYield = 0;
  const dividendPositions: any[] = [];

  holdingsData.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol || '';
    const value = (position.units || 0) * (position.price || 0);
    const dividendYield = dividendYieldMap[symbol] || 0;
    const annualDividend = value * (dividendYield / 100);

    if (dividendYield > 0) {
      totalDividendIncome += annualDividend;
      weightedDividendYield += dividendYield * (value / holdingsData.total_value?.value || 1);
      
      dividendPositions.push({
        symbol,
        value,
        dividendYield,
        annualDividend,
        monthlyDividend: annualDividend / 12
      });
    }
  });

  return {
    totalAnnualDividends: totalDividendIncome,
    totalMonthlyDividends: totalDividendIncome / 12,
    portfolioDividendYield: weightedDividendYield,
    dividendPositions: dividendPositions.sort((a, b) => b.annualDividend - a.annualDividend),
    dividendGrowthRate: 0 // Would require historical dividend data
  };
}

// ==================== TAX OPTIMIZATION ====================

export function analyzeTaxLossHarvesting(holdingsData: any) {
  const taxLossOpportunities: any[] = [];
  const taxGainPositions: any[] = [];
  let totalUnrealizedLosses = 0;
  let totalUnrealizedGains = 0;

  holdingsData.positions?.forEach((position: any) => {
    const currentValue = (position.units || 0) * (position.price || 0);
    const costBasis = (position.units || 0) * (position.average_purchase_price || 0);
    const unrealizedPnL = position.open_pnl || 0;
    const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

    const positionData = {
      symbol: position.symbol?.symbol?.symbol,
      currentValue,
      costBasis,
      unrealizedPnL,
      unrealizedPnLPercent,
      units: position.units
    };

    if (unrealizedPnL < -100) { // Loss positions > $100
      taxLossOpportunities.push(positionData);
      totalUnrealizedLosses += Math.abs(unrealizedPnL);
    } else if (unrealizedPnL > 100) { // Gain positions > $100
      taxGainPositions.push(positionData);
      totalUnrealizedGains += unrealizedPnL;
    }
  });

  return {
    totalUnrealizedLosses,
    totalUnrealizedGains,
    netTaxPosition: totalUnrealizedGains - totalUnrealizedLosses,
    taxLossOpportunities: taxLossOpportunities.sort((a, b) => a.unrealizedPnL - b.unrealizedPnL),
    taxGainPositions: taxGainPositions.sort((a, b) => b.unrealizedPnL - a.unrealizedPnL),
    harvestableAmount: Math.min(totalUnrealizedLosses, 3000), // IRS limit
    recommendations: generateTaxRecommendations(taxLossOpportunities, taxGainPositions)
  };
}

function generateTaxRecommendations(losses: any[], gains: any[]) {
  const recommendations = [];

  if (losses.length > 0) {
    recommendations.push({
      type: 'tax_loss_harvest',
      priority: 'high',
      description: `Consider harvesting ${losses.length} losing positions for tax benefits`,
      potentialSavings: Math.min(losses.reduce((sum, pos) => sum + Math.abs(pos.unrealizedPnL), 0), 3000) * 0.24 // Assume 24% tax rate
    });
  }

  if (gains.length > 0 && losses.length > 0) {
    recommendations.push({
      type: 'gain_loss_offset',
      priority: 'medium',
      description: 'Consider offsetting gains with losses to minimize tax impact'
    });
  }

  return recommendations;
}

// ==================== POSITION SIZING & RISK MANAGEMENT ====================

export function analyzePositionSizing(holdingsData: any, riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate') {
  const maxPositionLimits = {
    conservative: { single: 5, top5: 20, top10: 35 },
    moderate: { single: 10, top5: 35, top10: 50 },
    aggressive: { single: 15, top5: 50, top10: 70 }
  };

  const limits = maxPositionLimits[riskTolerance];
  const totalValue = holdingsData.total_value?.value || 0;
  const violations: any[] = [];
  const recommendations: any[] = [];

  // Analyze individual positions
  holdingsData.positions?.forEach((position: any, index: number) => {
    const value = (position.units || 0) * (position.price || 0);
    const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;
    const symbol = position.symbol?.symbol?.symbol;

    if (percentage > limits.single) {
      violations.push({
        type: 'overconcentration',
        symbol,
        currentWeight: percentage,
        maxRecommended: limits.single,
        excessValue: value - (totalValue * limits.single / 100),
        severity: percentage > limits.single * 1.5 ? 'high' : 'medium'
      });

      recommendations.push({
        action: 'reduce',
        symbol,
        currentValue: value,
        recommendedValue: totalValue * limits.single / 100,
        reductionAmount: value - (totalValue * limits.single / 100)
      });
    }
  });

  return {
    riskTolerance,
    limits,
    violations,
    recommendations,
    overallRiskScore: calculateRiskScore(holdingsData, violations.length),
    diversificationScore: calculateDiversificationScore(holdingsData)
  };
}

function calculateRiskScore(holdingsData: any, violationCount: number): number {
  // Risk score from 1-10 (1 = very low risk, 10 = very high risk)
  let riskScore = 1;

  // Position concentration risk
  riskScore += violationCount * 2;

  // Asset class concentration
  const composition = calculatePortfolioComposition(holdingsData);
  if (composition.equities > 80) riskScore += 2;
  if (composition.options > 20) riskScore += 3;
  if (composition.crypto > 10) riskScore += 2;

  // Cash level risk
  if (composition.cash < 5) riskScore += 1;
  if (composition.cash > 30) riskScore += 1;

  return Math.min(riskScore, 10);
}

function calculateDiversificationScore(holdingsData: any): number {
  // Diversification score from 1-10 (1 = poor, 10 = excellent)
  const positionCount = holdingsData.positions?.length || 0;
  const optionCount = holdingsData.option_positions?.length || 0;
  const totalPositions = positionCount + optionCount;

  let score = Math.min(totalPositions / 2, 5); // Base score from position count

  // Sector diversification (placeholder - would need real sector data)
  const sectorData = analyzeSectorAllocation(holdingsData);
  const sectorCount = sectorData.length;
  score += Math.min(sectorCount / 2, 3);

  // Asset class diversification
  const composition = calculatePortfolioComposition(holdingsData);
  const assetClasses = Object.values(composition).filter(val => val > 5).length;
  score += Math.min(assetClasses / 2, 2);

  return Math.min(score, 10);
}

// ==================== CORRELATION ANALYSIS ====================

export function analyzePortfolioCorrelation(holdingsData: any) {
  // This would require historical price data for correlation calculations
  // Placeholder structure for correlation analysis
  
  const correlationMatrix: { [key: string]: { [key: string]: number } } = {};
  const symbols = holdingsData.positions?.map((pos: any) => pos.symbol?.symbol?.symbol).filter(Boolean) || [];

  // Mock correlation data (would be calculated from historical prices)
  const mockCorrelations: { [key: string]: number } = {
    'AAPL-MSFT': 0.75,
    'AAPL-GOOGL': 0.68,
    'SPY-QQQ': 0.85,
    'JPM-XOM': 0.45
  };

  return {
    averageCorrelation: 0.6, // Placeholder
    highCorrelationPairs: [
      { symbol1: 'AAPL', symbol2: 'MSFT', correlation: 0.75 },
      { symbol1: 'SPY', symbol2: 'QQQ', correlation: 0.85 }
    ],
    diversificationBenefit: 0.25, // Placeholder - reduction in risk due to diversification
    recommendations: [
      {
        type: 'reduce_correlation',
        description: 'Consider reducing technology concentration to lower portfolio correlation',
        priority: 'medium'
      }
    ]
  };
}

// ==================== PERFORMANCE ATTRIBUTION ====================

export function analyzePerformanceAttribution(holdingsData: any) {
  const contributions: any[] = [];
  const totalValue = holdingsData.total_value?.value || 0;
  const totalPnL = holdingsData.positions?.reduce((sum: number, pos: any) => sum + (pos.open_pnl || 0), 0) || 0;

  holdingsData.positions?.forEach((position: any) => {
    const value = (position.units || 0) * (position.price || 0);
    const pnl = position.open_pnl || 0;
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
    const contribution = totalPnL !== 0 ? (pnl / totalPnL) * 100 : 0;

    contributions.push({
      symbol: position.symbol?.symbol?.symbol,
      value,
      weight,
      pnl,
      contribution,
      returnPercent: position.average_purchase_price ? 
        ((position.price || 0) - (position.average_purchase_price || 0)) / (position.average_purchase_price || 0) * 100 : 0
    });
  });

  // Sort by contribution to overall performance
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    totalReturn: totalPnL,
    topContributors: contributions.filter(c => c.contribution > 0).slice(0, 5),
    topDetractors: contributions.filter(c => c.contribution < 0).slice(0, 5),
    allContributions: contributions,
    concentrationRisk: contributions.slice(0, 3).reduce((sum, c) => sum + Math.abs(c.contribution), 0)
  };
}

// ==================== ESG SCORING ====================

export function analyzeESGExposure(holdingsData: any) {
  // Mock ESG scores (would come from external ESG data provider)
  const esgScores: { [key: string]: { environmental: number; social: number; governance: number; overall: number } } = {
    'AAPL': { environmental: 85, social: 90, governance: 88, overall: 88 },
    'MSFT': { environmental: 90, social: 85, governance: 92, overall: 89 },
    'TSLA': { environmental: 95, social: 75, governance: 70, overall: 80 },
    'XOM': { environmental: 30, social: 45, governance: 60, overall: 45 },
    'JPM': { environmental: 65, social: 70, governance: 85, overall: 73 }
  };

  let portfolioESG = { environmental: 0, social: 0, governance: 0, overall: 0 };
  let totalValue = 0;
  const esgBreakdown: any[] = [];

  holdingsData.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol;
    const value = (position.units || 0) * (position.price || 0);
    const weight = holdingsData.total_value?.value > 0 ? 
      value / holdingsData.total_value.value : 0;
    
    const scores = esgScores[symbol] || { environmental: 50, social: 50, governance: 50, overall: 50 };
    
    portfolioESG.environmental += scores.environmental * weight;
    portfolioESG.social += scores.social * weight;
    portfolioESG.governance += scores.governance * weight;
    portfolioESG.overall += scores.overall * weight;
    
    totalValue += value;
    
    esgBreakdown.push({
      symbol,
      value,
      weight: weight * 100,
      esgScores: scores
    });
  });

  return {
    portfolioESGScores: portfolioESG,
    esgBreakdown: esgBreakdown.sort((a, b) => b.value - a.value),
    recommendations: generateESGRecommendations(portfolioESG, esgBreakdown),
    esgRating: getESGRating(portfolioESG.overall)
  };
}

function generateESGRecommendations(portfolioESG: any, breakdown: any[]) {
  const recommendations = [];

  if (portfolioESG.environmental < 70) {
    recommendations.push({
      type: 'environmental',
      priority: 'high',
      description: 'Consider increasing allocation to environmentally friendly companies',
      currentScore: Math.round(portfolioESG.environmental)
    });
  }

  if (portfolioESG.governance < 75) {
    recommendations.push({
      type: 'governance',
      priority: 'medium',
      description: 'Review governance standards of current holdings',
      currentScore: Math.round(portfolioESG.governance)
    });
  }

  return recommendations;
}

function getESGRating(score: number): string {
  if (score >= 90) return 'AAA';
  if (score >= 80) return 'AA';
  if (score >= 70) return 'A';
  if (score >= 60) return 'BBB';
  if (score >= 50) return 'BB';
  return 'B';
}

// ==================== COMPREHENSIVE RISK DASHBOARD ====================

export async function generateRiskDashboard(
  snaptradeUserId: string, 
  userSecret: string,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
) {
  try {
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: snaptradeUserId,
      userSecret: userSecret
    });

    const firstAccountId = accountsResponse.data?.[0]?.id;

    if (!firstAccountId) {
      return { error: 'No linked accounts found for user.' };
    }

    const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
      userId: snaptradeUserId,
      userSecret: userSecret,
      accountId: firstAccountId
    });

    if ((holdingsResponse.data as any)?.error) {
      return { error: (holdingsResponse.data as any).error };
    }

    const holdings = holdingsResponse.data;

    return {
      riskSummary: {
        overallRiskScore: calculateRiskScore(holdings, 0),
        diversificationScore: calculateDiversificationScore(holdings),
        concentrationRisk: analyzePositionSizing(holdings, riskTolerance),
        correlationRisk: analyzeCorrelationRisk(holdings)
      },
      
      sectorAnalysis: analyzeSectorAllocation(holdings),
      positionSizing: analyzePositionSizing(holdings, riskTolerance),
      performanceAttribution: analyzePerformanceAttribution(holdings),
      
      taxOptimization: analyzeTaxLossHarvesting(holdings),
      dividendAnalysis: calculateDividendMetrics(holdings),
      esgAnalysis: analyzeESGExposure(holdings),
      
      actionItems: generateRiskActionItems(holdings, riskTolerance),
      
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating risk dashboard:', error);
    return { error: 'Failed to generate risk dashboard.' };
  }
}

function analyzeCorrelationRisk(holdings: any) {
  // Simplified correlation risk analysis
  const techCount = holdings.positions?.filter((pos: any) => 
    ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'QQQ'].includes(pos.symbol?.symbol?.symbol)
  ).length || 0;
  
  return {
    level: techCount > 3 ? 'high' : techCount > 1 ? 'medium' : 'low',
    techConcentration: techCount,
    recommendation: techCount > 3 ? 'Consider reducing technology sector concentration' : 'Acceptable correlation levels'
  };
}

function generateRiskActionItems(holdings: any, riskTolerance: string) {
  const actionItems = [];
  const positionSizing = analyzePositionSizing(holdings, riskTolerance as any);
  const taxAnalysis = analyzeTaxLossHarvesting(holdings);
  
  // High priority items
  if (positionSizing.violations.length > 0) {
    actionItems.push({
      priority: 'high',
      category: 'position_sizing',
      description: `${positionSizing.violations.length} positions exceed recommended allocation limits`,
      action: 'Review and rebalance overconcentrated positions'
    });
  }

  if (taxAnalysis.taxLossOpportunities.length > 0) {
    actionItems.push({
      priority: 'medium',
      category: 'tax_optimization',
      description: `${taxAnalysis.taxLossOpportunities.length} positions available for tax loss harvesting`,
      action: 'Consider harvesting losses for tax benefits'
    });
  }

  return actionItems.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
  });
}

// Helper function import (needed for some calculations)
function calculatePortfolioComposition(holdingsData: any) {
  // This should import from your portfolio-analytics file
  // Simplified version here for completeness
  const totalValue = holdingsData.total_value?.value || 0;
  if (totalValue === 0) return { cash: 0, equities: 0, options: 0, crypto: 0, other: 0 };
  
  const cash = holdingsData.balances?.reduce((sum: number, balance: any) => sum + (balance.cash || 0), 0) || 0;
  // Add other calculations as needed
  
  return {
    cash: (cash / totalValue) * 100,
    equities: 0, // Calculate based on positions
    options: 0,  // Calculate based on option_positions
    crypto: 0,   // Calculate based on crypto positions
    other: 0     // Calculate remaining
  };
}
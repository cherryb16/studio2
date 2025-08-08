// src/app/actions/core/risk-calculations.ts
// Pure risk calculation functions - accepts external data as parameters

import { HoldingsData, calculatePortfolioComposition } from './portfolio-calculations';

// ==================== POSITION SIZING & RISK MANAGEMENT ====================

export function analyzePositionSizing(
  holdingsData: HoldingsData, 
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
) {
  const maxPositionLimits = {
    conservative: { single: 5, top5: 20, top10: 35 },
    moderate: { single: 10, top5: 35, top10: 50 },
    aggressive: { single: 15, top5: 50, top10: 70 }
  };

  const limits = maxPositionLimits[riskTolerance];
  const totalValue = holdingsData.total_value?.value || 0;
  const violations: any[] = [];
  const recommendations: any[] = [];

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

export function calculateRiskScore(holdingsData: HoldingsData, violationCount: number): number {
  let riskScore = 1;

  riskScore += violationCount * 2;

  const composition = calculatePortfolioComposition(holdingsData);
  if (composition.equities > 80) riskScore += 2;
  if (composition.options > 20) riskScore += 3;
  if (composition.crypto > 10) riskScore += 2;

  if (composition.cash < 5) riskScore += 1;
  if (composition.cash > 30) riskScore += 1;

  return Math.min(riskScore, 10);
}

export function calculateDiversificationScore(holdingsData: HoldingsData): number {
  const positionCount = holdingsData.positions?.length || 0;
  const optionCount = holdingsData.option_positions?.length || 0;
  const totalPositions = positionCount + optionCount;

  let score = Math.min(totalPositions / 2, 5);

  const composition = calculatePortfolioComposition(holdingsData);
  const assetClasses = Object.values(composition).filter(val => val > 5).length;
  score += Math.min(assetClasses / 2, 2);

  return Math.min(score, 10);
}

// ==================== TAX OPTIMIZATION ====================

export function analyzeTaxLossHarvesting(holdingsData: HoldingsData) {
  const taxLossOpportunities: any[] = [];
  const taxGainPositions: any[] = [];
  let totalUnrealizedLosses = 0;
  let totalUnrealizedGains = 0;

  // Process regular positions
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
      units: position.units,
      type: 'equity'
    };

    if (unrealizedPnL < -100) {
      taxLossOpportunities.push(positionData);
      totalUnrealizedLosses += Math.abs(unrealizedPnL);
    } else if (unrealizedPnL > 100) {
      taxGainPositions.push(positionData);
      totalUnrealizedGains += unrealizedPnL;
    }
  });

  // Process option positions
  holdingsData.option_positions?.forEach((position: any) => {
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
      units: position.units,
      type: 'option'
    };

    if (unrealizedPnL < -100) {
      taxLossOpportunities.push(positionData);
      totalUnrealizedLosses += Math.abs(unrealizedPnL);
    } else if (unrealizedPnL > 100) {
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
    harvestableAmount: Math.min(totalUnrealizedLosses, 3000),
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
      potentialSavings: Math.min(losses.reduce((sum, pos) => sum + Math.abs(pos.unrealizedPnL), 0), 3000) * 0.24
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

// ==================== SECTOR ALLOCATION ANALYSIS ====================

export function analyzeSectorAllocation(
  holdingsData: HoldingsData, 
  sectorData: Map<string, string>
): any[] {
  const sectorTotals: { [key: string]: { value: number; positions: any[] } } = {};
  const totalPortfolioValue = holdingsData.total_value?.value || 0;

  holdingsData.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol || '';
    const value = (position.units || 0) * (position.price || 0);
    const sector = sectorData.get(symbol) || 'Other';

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

export function calculateDividendMetrics(
  holdingsData: HoldingsData,
  dividendData: Map<string, number>
) {
  let totalDividendIncome = 0;
  let weightedDividendYield = 0;
  const dividendPositions: any[] = [];

  holdingsData.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol || '';
    const value = (position.units || 0) * (position.price || 0);
    const dividendYield = dividendData.get(symbol) || 0;
    const annualDividend = value * (dividendYield / 100);

    if (dividendYield > 0) {
      totalDividendIncome += annualDividend;
      const totalValue = holdingsData.total_value?.value || 1;
      weightedDividendYield += dividendYield * (value / totalValue);
      
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

// ==================== CORRELATION ANALYSIS ====================

export function analyzePortfolioCorrelation(
  holdingsData: HoldingsData,
  correlationMatrix: Map<string, Map<string, number>>
) {
  const symbols = holdingsData.positions?.map((pos: any) => pos.symbol?.symbol?.symbol).filter(Boolean) || [];
  
  let totalCorrelations = 0;
  let correlationCount = 0;
  const highCorrelationPairs: Array<{symbol1: string; symbol2: string; correlation: number}> = [];

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const symbol1 = symbols[i];
      const symbol2 = symbols[j];
      const correlation = correlationMatrix.get(symbol1)?.get(symbol2) || 
                         correlationMatrix.get(symbol2)?.get(symbol1) || 0;

      if (correlation !== 0) {
        totalCorrelations += Math.abs(correlation);
        correlationCount++;

        if (Math.abs(correlation) > 0.7) {
          highCorrelationPairs.push({ symbol1, symbol2, correlation });
        }
      }
    }
  }

  const averageCorrelation = correlationCount > 0 ? totalCorrelations / correlationCount : 0;

  return {
    averageCorrelation,
    highCorrelationPairs: highCorrelationPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
    diversificationBenefit: Math.max(0, 1 - averageCorrelation),
    recommendations: generateCorrelationRecommendations(highCorrelationPairs)
  };
}

function generateCorrelationRecommendations(highCorrelationPairs: any[]) {
  const recommendations = [];

  if (highCorrelationPairs.length > 0) {
    recommendations.push({
      type: 'reduce_correlation',
      description: `Consider reducing correlation by diversifying away from ${highCorrelationPairs.length} highly correlated pairs`,
      priority: 'medium',
      pairs: highCorrelationPairs.slice(0, 3)
    });
  }

  return recommendations;
}

// ==================== PERFORMANCE ATTRIBUTION ====================

export function analyzePerformanceAttribution(holdingsData: HoldingsData) {
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

  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    totalReturn: totalPnL,
    topContributors: contributions.filter(c => c.contribution > 0).slice(0, 5),
    topDetractors: contributions.filter(c => c.contribution < 0).slice(0, 5),
    allContributions: contributions,
    concentrationRisk: contributions.slice(0, 3).reduce((sum, c) => sum + Math.abs(c.contribution), 0)
  };
}

// ==================== ESG ANALYSIS ====================

export function analyzeESGExposure(
  holdingsData: HoldingsData,
  esgData: Map<string, { environmental: number; social: number; governance: number; overall: number }>
) {
  let portfolioESG = { environmental: 0, social: 0, governance: 0, overall: 0 };
  let calculatedTotalValue = 0;
  const esgBreakdown: any[] = [];

  holdingsData.positions?.forEach((position: any) => {
    const symbol = position.symbol?.symbol?.symbol;
    const value = (position.units || 0) * (position.price || 0);
    const totalValue = holdingsData.total_value?.value || 0;
    const weight = totalValue > 0 ? value / totalValue : 0;
    
    const scores = esgData.get(symbol) || { environmental: 50, social: 50, governance: 50, overall: 50 };
    
    portfolioESG.environmental += scores.environmental * weight;
    portfolioESG.social += scores.social * weight;
    portfolioESG.governance += scores.governance * weight;
    portfolioESG.overall += scores.overall * weight;
    
    calculatedTotalValue += value;
    
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

// ==================== RISK ACTION ITEMS ====================

export function generateRiskActionItems(
  holdingsData: HoldingsData, 
  riskTolerance: string,
  sectorData?: Map<string, string>
) {
  const actionItems = [];
  const positionSizing = analyzePositionSizing(holdingsData, riskTolerance as any);
  const taxAnalysis = analyzeTaxLossHarvesting(holdingsData);

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
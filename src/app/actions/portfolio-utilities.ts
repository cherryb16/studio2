// src/app/actions/portfolio-utilities.ts
'use server';

import { db } from '@/lib/firebase-admin';
import { snaptrade } from './snaptrade';

// ==================== DATA EXPORT FUNCTIONS ====================

export async function exportPortfolioData(
  snaptradeUserId: string,
  userSecret: string,
  format: 'json' | 'csv' = 'json'
) {
  try {
    const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    if ((holdingsResponse.data as any)?.error) {
      return { error: (holdingsResponse.data as any).error };
    }

    const holdings = holdingsResponse.data;
    const exportData = {
      exportDate: new Date().toISOString(),
      totalValue: holdings.total_value?.value || 0,
      positions: holdings.positions?.map(pos => ({
        symbol: pos.symbol?.symbol?.symbol,
        description: pos.symbol?.symbol?.description,
        units: pos.units,
        currentPrice: pos.price,
        marketValue: (pos.units || 0) * (pos.price || 0),
        averageCost: pos.average_purchase_price,
        totalCost: (pos.units || 0) * (pos.average_purchase_price || 0),
        unrealizedPnL: pos.open_pnl,
        unrealizedPnLPercent: pos.average_purchase_price ? 
          ((pos.price || 0) - (pos.average_purchase_price || 0)) / (pos.average_purchase_price || 0) * 100 : 0,
        assetType: pos.symbol?.symbol?.type?.description || 'Unknown',
        exchange: pos.symbol?.symbol?.exchange?.name || 'Unknown'
      })) || [],
      options: holdings.option_positions?.map(opt => ({
        ticker: opt.symbol?.option_symbol?.ticker,
        underlyingSymbol: opt.symbol?.option_symbol?.underlying_symbol?.symbol,
        optionType: opt.symbol?.option_symbol?.option_type,
        strikePrice: opt.symbol?.option_symbol?.strike_price,
        expirationDate: opt.symbol?.option_symbol?.expiration_date,
        contracts: Math.abs(opt.units || 0),
        currentPrice: opt.price,
        marketValue: Math.abs((opt.units || 0) * (opt.price || 0) * 100),
        averageCost: opt.average_purchase_price,
        totalCost: Math.abs((opt.units || 0) * (opt.average_purchase_price || 0) * 100),
        position: (opt.units || 0) > 0 ? 'Long' : 'Short'
      })) || [],
      balances: holdings.balances?.map(bal => ({
        currency: bal.currency?.code,
        cash: bal.cash,
        buyingPower: bal.buying_power
      })) || []
    };

    if (format === 'csv') {
      return {
        format: 'csv',
        data: convertToCSV(exportData)
      };
    }

    return {
      format: 'json',
      data: exportData
    };

  } catch (error) {
    console.error('Error exporting portfolio data:', error);
    return { error: 'Failed to export portfolio data.' };
  }
}

function convertToCSV(data: any): string {
  const headers = [
    'Type', 'Symbol', 'Description', 'Quantity', 'Current Price', 
    'Market Value', 'Average Cost', 'Total Cost', 'Unrealized P&L', 'Unrealized P&L %'
  ];
  
  let csv = headers.join(',') + '\n';
  
  // Add equity positions
  data.positions.forEach((pos: any) => {
    csv += [
      'Equity',
      pos.symbol,
      `"${pos.description}"`,
      pos.units,
      pos.currentPrice,
      pos.marketValue,
      pos.averageCost,
      pos.totalCost,
      pos.unrealizedPnL,
      pos.unrealizedPnLPercent.toFixed(2) + '%'
    ].join(',') + '\n';
  });
  
  // Add options positions
  data.options.forEach((opt: any) => {
    csv += [
      'Option',
      opt.ticker,
      `"${opt.underlyingSymbol} ${opt.optionType}"`,
      opt.contracts,
      opt.currentPrice,
      opt.marketValue,
      opt.averageCost,
      opt.totalCost,
      (opt.marketValue - opt.totalCost),
      ((opt.marketValue - opt.totalCost) / opt.totalCost * 100).toFixed(2) + '%'
    ].join(',') + '\n';
  });
  
  return csv;
}

// ==================== PORTFOLIO ALERTS & MONITORING ====================

interface AlertRule {
  id: string;
  type: 'price_change' | 'position_size' | 'pnl_threshold' | 'sector_concentration';
  symbol?: string;
  threshold: number;
  condition: 'above' | 'below' | 'change_percent';
  isActive: boolean;
  lastTriggered?: string;
}

export async function checkPortfolioAlerts(
  firebaseUserId: string,
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    // Get user's alert rules from Firestore
    const alertRulesDoc = await db.collection('portfolio_alerts').doc(firebaseUserId).get();
    const alertRules: AlertRule[] = alertRulesDoc.exists ? alertRulesDoc.data()?.rules || [] : [];

    if (alertRules.length === 0) {
      return { alerts: [], triggeredCount: 0 };
    }

    // Get current holdings
    const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    if ((holdingsResponse.data as any)?.error) {
      return { error: (holdingsResponse.data as any).error };
    }

    const holdings = holdingsResponse.data;
    const triggeredAlerts: any[] = [];

    // Check each alert rule
    for (const rule of alertRules.filter(r => r.isActive)) {
      const alert = await evaluateAlertRule(rule, holdings);
      if (alert) {
        triggeredAlerts.push(alert);
        
        // Update last triggered time
        rule.lastTriggered = new Date().toISOString();
      }
    }

    // Update alert rules in Firestore if any were triggered
    if (triggeredAlerts.length > 0) {
      await db.collection('portfolio_alerts').doc(firebaseUserId).set({
        rules: alertRules,
        lastChecked: new Date().toISOString()
      }, { merge: true });
    }

    return {
      alerts: triggeredAlerts,
      triggeredCount: triggeredAlerts.length,
      totalRules: alertRules.length
    };

  } catch (error) {
    console.error('Error checking portfolio alerts:', error);
    return { error: 'Failed to check portfolio alerts.' };
  }
}

async function evaluateAlertRule(rule: AlertRule, holdings: any) {
  const now = new Date().toISOString();
  
  switch (rule.type) {
    case 'position_size':
      const position = holdings.positions?.find((pos: any) => 
        pos.symbol?.symbol?.symbol === rule.symbol
      );
      if (position) {
        const value = (position.units || 0) * (position.price || 0);
        const percentage = holdings.total_value?.value > 0 ? 
          (value / holdings.total_value.value) * 100 : 0;
        
        if ((rule.condition === 'above' && percentage > rule.threshold) ||
            (rule.condition === 'below' && percentage < rule.threshold)) {
          return {
            id: rule.id,
            type: rule.type,
            symbol: rule.symbol,
            message: `${rule.symbol} position size is ${percentage.toFixed(2)}% (${rule.condition} ${rule.threshold}%)`,
            severity: percentage > rule.threshold * 1.5 ? 'high' : 'medium',
            currentValue: percentage,
            threshold: rule.threshold,
            triggeredAt: now
          };
        }
      }
      break;

    case 'pnl_threshold':
      const targetPosition = holdings.positions?.find((pos: any) => 
        pos.symbol?.symbol?.symbol === rule.symbol
      );
      if (targetPosition) {
        const pnlPercent = targetPosition.average_purchase_price ? 
          ((targetPosition.price || 0) - (targetPosition.average_purchase_price || 0)) / 
          (targetPosition.average_purchase_price || 0) * 100 : 0;
        
        if ((rule.condition === 'above' && pnlPercent > rule.threshold) ||
            (rule.condition === 'below' && pnlPercent < rule.threshold)) {
          return {
            id: rule.id,
            type: rule.type,
            symbol: rule.symbol,
            message: `${rule.symbol} P&L is ${pnlPercent.toFixed(2)}% (${rule.condition} ${rule.threshold}%)`,
            severity: Math.abs(pnlPercent) > Math.abs(rule.threshold) * 1.5 ? 'high' : 'medium',
            currentValue: pnlPercent,
            threshold: rule.threshold,
            triggeredAt: now
          };
        }
      }
      break;

    case 'sector_concentration':
      // This would require sector classification data
      // Placeholder implementation
      break;

    case 'price_change':
      // This would require historical price data to calculate daily changes
      // Placeholder implementation
      break;
  }
  
  return null;
}

// ==================== ALERT MANAGEMENT ====================

export async function createAlertRule(
  firebaseUserId: string,
  alertRule: Omit<AlertRule, 'id'>
) {
  try {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRule: AlertRule = {
      ...alertRule,
      id: alertId,
      isActive: true
    };

    const alertDoc = await db.collection('portfolio_alerts').doc(firebaseUserId).get();
    const existingRules = alertDoc.exists ? alertDoc.data()?.rules || [] : [];
    
    await db.collection('portfolio_alerts').doc(firebaseUserId).set({
      rules: [...existingRules, newRule],
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true, alertId };
  } catch (error) {
    console.error('Error creating alert rule:', error);
    return { error: 'Failed to create alert rule.' };
  }
}

export async function updateAlertRule(
  firebaseUserId: string,
  alertId: string,
  updates: Partial<AlertRule>
) {
  try {
    const alertDoc = await db.collection('portfolio_alerts').doc(firebaseUserId).get();
    if (!alertDoc.exists) {
      return { error: 'No alerts found for user.' };
    }

    const rules: AlertRule[] = alertDoc.data()?.rules || [];
    const ruleIndex = rules.findIndex(rule => rule.id === alertId);
    
    if (ruleIndex === -1) {
      return { error: 'Alert rule not found.' };
    }

    rules[ruleIndex] = { ...rules[ruleIndex], ...updates };
    
    await db.collection('portfolio_alerts').doc(firebaseUserId).set({
      rules,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Error updating alert rule:', error);
    return { error: 'Failed to update alert rule.' };
  }
}

export async function deleteAlertRule(firebaseUserId: string, alertId: string) {
  try {
    const alertDoc = await db.collection('portfolio_alerts').doc(firebaseUserId).get();
    if (!alertDoc.exists) {
      return { error: 'No alerts found for user.' };
    }

    const rules: AlertRule[] = alertDoc.data()?.rules || [];
    const filteredRules = rules.filter(rule => rule.id !== alertId);
    
    await db.collection('portfolio_alerts').doc(firebaseUserId).set({
      rules: filteredRules,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    return { error: 'Failed to delete alert rule.' };
  }
}

// ==================== PORTFOLIO COMPARISON & BENCHMARKING ====================

export async function compareWithBenchmarks(
  snaptradeUserId: string,
  userSecret: string,
  benchmarks: string[] = ['SPY', 'QQQ', 'VTI']
) {
  try {
    const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    if ((holdingsResponse.data as any)?.error) {
      return { error: (holdingsResponse.data as any).error };
    }

    const holdings = holdingsResponse.data;
    const portfolioValue = holdings.total_value?.value || 0;
    const portfolioPnL = holdings.positions?.reduce((sum: number, pos: any) => 
      sum + (pos.open_pnl || 0), 0) || 0;
    const portfolioReturn = portfolioValue > 0 ? (portfolioPnL / (portfolioValue - portfolioPnL)) * 100 : 0;

    // Mock benchmark data (would come from market data API)
    const benchmarkData = {
      'SPY': { return: 8.2, volatility: 16.5, name: 'S&P 500' },
      'QQQ': { return: 12.1, volatility: 22.3, name: 'NASDAQ 100' },
      'VTI': { return: 7.8, volatility: 15.8, name: 'Total Stock Market' }
    };

    const comparisons = benchmarks.map(benchmark => ({
      symbol: benchmark,
      name: benchmarkData[benchmark as keyof typeof benchmarkData]?.name || benchmark,
      return: benchmarkData[benchmark as keyof typeof benchmarkData]?.return || 0,
      volatility: benchmarkData[benchmark as keyof typeof benchmarkData]?.volatility || 0,
      outperformance: portfolioReturn - (benchmarkData[benchmark as keyof typeof benchmarkData]?.return || 0)
    }));

    return {
      portfolioReturn,
      portfolioValue,
      benchmarks: comparisons,
      analysis: {
        bestPerforming: comparisons.reduce((best, current) => 
          current.outperformance > best.outperformance ? current : best),
        averageOutperformance: comparisons.reduce((sum, comp) => 
          sum + comp.outperformance, 0) / comparisons.length,
        riskAdjustedReturn: portfolioReturn / 18.0 // Assuming 18% portfolio volatility
      }
    };

  } catch (error) {
    console.error('Error comparing with benchmarks:', error);
    return { error: 'Failed to compare with benchmarks.' };
  }
}

// ==================== PORTFOLIO HEALTH SCORE ====================

export async function calculatePortfolioHealthScore(
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    if ((holdingsResponse.data as any)?.error) {
      return { error: (holdingsResponse.data as any).error };
    }

    const holdings = holdingsResponse.data;
    let healthScore = 0;
    const maxScore = 100;
    const scoreBreakdown: any = {};

    // Diversification Score (30 points max)
    const positionCount = (holdings.positions?.length || 0) + (holdings.option_positions?.length || 0);
    const diversificationScore = Math.min((positionCount / 10) * 30, 30);
    scoreBreakdown.diversification = {
      score: diversificationScore,
      maxScore: 30,
      description: `${positionCount} total positions`
    };

    // Asset Allocation Score (25 points max)
    const totalValue = holdings.total_value?.value || 0;
    const cashBalance = holdings.balances?.reduce((sum: number, bal: any) => sum + (bal.cash || 0), 0) || 0;
    const cashPercent = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;
    
    // Ideal cash allocation: 5-15%
    let allocationScore = 25;
    if (cashPercent < 5 || cashPercent > 15) {
      allocationScore = Math.max(0, 25 - Math.abs(cashPercent - 10) * 2);
    }
    scoreBreakdown.allocation = {
      score: allocationScore,
      maxScore: 25,
      description: `${cashPercent.toFixed(1)}% cash allocation`
    };

    // Risk Management Score (25 points max)
    const topPosition = holdings.positions?.reduce((largest: any, pos: any) => {
      const value = (pos.units || 0) * (pos.price || 0);
      const largestValue = (largest?.units || 0) * (largest?.price || 0);
      return value > largestValue ? pos : largest;
    }, null);
    
    const topPositionPercent = topPosition && totalValue > 0 ? 
      ((topPosition.units || 0) * (topPosition.price || 0) / totalValue) * 100 : 0;
    
    let riskScore = 25;
    if (topPositionPercent > 20) {
      riskScore = Math.max(0, 25 - (topPositionPercent - 20) * 2);
    }
    scoreBreakdown.riskManagement = {
      score: riskScore,
      maxScore: 25,
      description: `Largest position: ${topPositionPercent.toFixed(1)}%`
    };

    // Performance Score (20 points max)
    const portfolioPnL = holdings.positions?.reduce((sum: number, pos: any) => 
      sum + (pos.open_pnl || 0), 0) || 0;
    const portfolioReturn = totalValue > 0 ? (portfolioPnL / (totalValue - portfolioPnL)) * 100 : 0;
    
    let performanceScore = 10; // Neutral baseline
    if (portfolioReturn > 0) {
      performanceScore = Math.min(20, 10 + portfolioReturn);
    } else {
      performanceScore = Math.max(0, 10 + portfolioReturn);
    }
    scoreBreakdown.performance = {
      score: performanceScore,
      maxScore: 20,
      description: `${portfolioReturn.toFixed(2)}% unrealized return`
    };

    healthScore = diversificationScore + allocationScore + riskScore + performanceScore;

    return {
      healthScore: Math.round(healthScore),
      maxScore,
      grade: getHealthGrade(healthScore),
      scoreBreakdown,
      recommendations: generateHealthRecommendations(scoreBreakdown),
      lastCalculated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error calculating portfolio health score:', error);
    return { error: 'Failed to calculate portfolio health score.' };
  }
}

function getHealthGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 45) return 'D';
  return 'F';
}

function generateHealthRecommendations(scoreBreakdown: any) {
  const recommendations = [];

  if (scoreBreakdown.diversification.score < 20) {
    recommendations.push({
      category: 'diversification',
      priority: 'high',
      action: 'Increase portfolio diversification by adding more positions across different sectors'
    });
  }

  if (scoreBreakdown.allocation.score < 15) {
    recommendations.push({
      category: 'allocation',
      priority: 'medium',
      action: 'Adjust cash allocation to 5-15% of total portfolio value'
    });
  }

  if (scoreBreakdown.riskManagement.score < 15) {
    recommendations.push({
      category: 'risk',
      priority: 'high',
      action: 'Reduce concentration risk by limiting individual positions to <20% of portfolio'
    });
  }

  if (scoreBreakdown.performance.score < 10) {
    recommendations.push({
      category: 'performance',
      priority: 'medium',
      action: 'Review underperforming positions and consider rebalancing strategy'
    });
  }

  return recommendations;
}

// ==================== SCHEDULED ANALYTICS ====================

export async function schedulePortfolioAnalysis(
  firebaseUserId: string,
  frequency: 'daily' | 'weekly' | 'monthly' = 'weekly'
) {
  try {
    const scheduleData = {
      userId: firebaseUserId,
      frequency,
      enabled: true,
      lastRun: null,
      nextRun: calculateNextRun(frequency),
      createdAt: new Date().toISOString()
    };

    await db.collection('portfolio_schedules').doc(firebaseUserId).set(scheduleData, { merge: true });

    return { success: true, nextRun: scheduleData.nextRun };
  } catch (error) {
    console.error('Error scheduling portfolio analysis:', error);
    return { error: 'Failed to schedule portfolio analysis.' };
  }
}

function calculateNextRun(frequency: string): string {
  const now = new Date();
  const nextRun = new Date(now);

  switch (frequency) {
    case 'daily':
      nextRun.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      nextRun.setMonth(now.getMonth() + 1);
      break;
  }

  return nextRun.toISOString();
}

// ==================== PORTFOLIO SUMMARY FOR DASHBOARD ====================

export async function getDashboardSummary(
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    const [
      portfolioAnalytics,
      portfolioHealth,
      benchmarkComparison,
      alerts
    ] = await Promise.all([
      getPortfolioAnalytics(snaptradeUserId, userSecret),
      calculatePortfolioHealthScore(snaptradeUserId, userSecret),
      compareWithBenchmarks(snaptradeUserId, userSecret),
      checkPortfolioAlerts('', snaptradeUserId, userSecret) // Would need firebaseUserId
    ]);

    return {
      summary: {
        totalValue: (portfolioAnalytics as any).totalBalance || 0,
        dayChange: 0, // Would need historical data
        dayChangePercent: 0, // Would need historical data
        unrealizedPnL: (portfolioAnalytics as any).unrealizedPnL?.total || 0,
        unrealizedPnLPercent: (portfolioAnalytics as any).unrealizedPnL?.totalPercentage || 0
      },
      
      healthScore: (portfolioHealth as any).healthScore || 0,
      grade: (portfolioHealth as any).grade || 'N/A',
      
      composition: (portfolioAnalytics as any).composition || {},
      topPositions: (portfolioAnalytics as any).topPositions?.slice(0, 5) || [],
      
      alerts: {
        count: (alerts as any).triggeredCount || 0,
        recent: (alerts as any).alerts?.slice(0, 3) || []
      },
      
      benchmarkOutperformance: (benchmarkComparison as any).analysis?.averageOutperformance || 0,
      
      quickStats: {
        totalPositions: (portfolioAnalytics as any).diversification?.totalPositions || 0,
        assetClasses: (portfolioAnalytics as any).diversification?.assetClasses || 0,
        concentrationRisk: (portfolioAnalytics as any).concentration?.top1Concentration || 0
      },
      
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating dashboard summary:', error);
    return { error: 'Failed to generate dashboard summary.' };
  }
}

// Import function that was referenced but not defined
import { getPortfolioAnalytics } from './snaptrade-enhanced';
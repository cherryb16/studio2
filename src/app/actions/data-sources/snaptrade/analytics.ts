// src/app/actions/data-sources/snaptrade/analytics.ts
'use server';

import { getUserHoldings } from './positions';
import { getSnapTradeAccounts } from './accounts';
import { 
  generatePortfolioSummary, 
  calculateTotalBalance, 
  calculateCashBalance,
  calculateEquitiesBalance,
  calculateOptionsBalance,
  calculateTotalUnrealizedPnL 
} from '../../core/portfolio-calculations';

// Add missing function for backwards compatibility
export async function getPerformanceMetrics(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    const holdings = await getUserHoldings(snaptradeUserId, userSecret, accountId);
    if ('error' in holdings) {
      return holdings;
    }
    
    // Calculate basic metrics
    const totalValue = holdings.total_value?.value || 0;
    const totalPnL = holdings.positions?.reduce((sum: number, pos: any) => sum + (pos.open_pnl || 0), 0) || 0;
    const positionCount = (holdings.positions?.length || 0) + (holdings.option_positions?.length || 0);
    
    // Calculate cost basis (total invested amount)
    const totalCostBasis = holdings.positions?.reduce((sum: number, pos: any) => {
      const units = pos.units || 0;
      const avgPrice = pos.average_purchase_price || 0;
      return sum + (units * avgPrice);
    }, 0) || 0;
    
    // Calculate returns
    const totalReturn = totalPnL;
    const totalReturnPercentage = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0;
    
    // Calculate portfolio volatility (simplified approach using position weights and returns)
    const positions = holdings.positions || [];
    const positionReturns = positions.map((pos: any) => {
      const currentValue = (pos.units || 0) * (pos.price || 0);
      const costBasis = (pos.units || 0) * (pos.average_purchase_price || 0);
      return costBasis > 0 ? ((currentValue - costBasis) / costBasis) : 0;
    });
    
    // Calculate volatility as standard deviation of position returns
    const meanReturn = positionReturns.reduce((sum: number, ret: number) => sum + ret, 0) / positionReturns.length;
    const variance = positionReturns.reduce((sum: number, ret: number) => sum + Math.pow(ret - meanReturn, 2), 0) / positionReturns.length;
    const volatility = Math.sqrt(variance) * 100; // Convert to percentage
    
    // Calculate Sharpe Ratio (assuming 4.5% risk-free rate)
    const riskFreeRate = 4.5; // 4.5% annual risk-free rate
    const excessReturn = totalReturnPercentage - riskFreeRate;
    const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;
    
    // Generate sample historical data for chart (placeholder - would be real historical data in production)
    const historicalData = generateSampleHistoricalData(totalValue, totalReturnPercentage);
    
    return {
      totalValue,
      totalPnL,
      totalReturn,
      totalReturnPercentage,
      totalCostBasis,
      positionCount,
      volatility,
      sharpeRatio,
      historicalData,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return { error: 'Failed to get performance metrics.' };
  }
}

// Generate sample historical performance data
function generateSampleHistoricalData(currentValue: number, currentReturnPct: number) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = [];
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  
  // Calculate starting value based on current return
  const startValue = currentReturnPct !== 0 ? currentValue / (1 + (currentReturnPct / 100)) : currentValue * 0.9;
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(startDate);
    date.setMonth(startDate.getMonth() + i);
    
    // Generate progressive growth towards current value with some volatility
    const progress = i / 11; // 0 to 1
    const baseValue = startValue + (currentValue - startValue) * progress;
    const volatilityFactor = 1 + (Math.random() - 0.5) * 0.1; // ±5% random volatility
    const value = Math.max(baseValue * volatilityFactor, 0);
    
    data.push({
      month: months[date.getMonth()],
      portfolio: Math.round(value),
      date: date.toISOString().split('T')[0]
    });
  }
  
  return data;
}

// Helper to ensure account property is present
function normalizeHoldingsData(holdings: any, accountId?: string): any {
  return {
    ...holdings,
    account: holdings.account ?? (accountId ? { id: accountId } : {})
  };
}

export async function getPortfolioAnalytics(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    const holdings = await getUserHoldings(snaptradeUserId, userSecret, accountId);
    if ('error' in holdings) {
      return holdings;
    }
    return generatePortfolioSummary(normalizeHoldingsData(holdings, accountId));
  } catch (error) {
    console.error('Error getting portfolio analytics:', error);
    return { error: 'Failed to get portfolio analytics.' };
  }
}

export async function getPortfolioOverview(
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    const accountsResponse = await getSnapTradeAccounts(snaptradeUserId, userSecret);
    if ('error' in accountsResponse) {
      return accountsResponse;
    }
    
    let totalBalance = 0;
    let totalCash = 0;
    let totalEquities = 0;
    let totalOptions = 0;
    let totalUnrealizedPnL = 0;
    const accountSummaries = [];
    
    for (const account of accountsResponse) {
      const holdings = await getUserHoldings(snaptradeUserId, userSecret, account.id);
      if (!('error' in holdings)) {
        const normalizedHoldings = normalizeHoldingsData(holdings, account.id);
        const accountBalance = calculateTotalBalance(normalizedHoldings);
        const accountCash = calculateCashBalance(normalizedHoldings);
        const accountEquities = calculateEquitiesBalance(normalizedHoldings);
        const accountOptions = calculateOptionsBalance(normalizedHoldings.option_positions);
        const accountPnL = calculateTotalUnrealizedPnL(normalizedHoldings);
        
        totalBalance += accountBalance;
        totalCash += accountCash;
        totalEquities += accountEquities;
        totalOptions += accountOptions;
        totalUnrealizedPnL += accountPnL;
        
        accountSummaries.push({
          accountId: account.id,
          accountName: account.name,
          balance: accountBalance,
          cash: accountCash,
          equities: accountEquities,
          options: accountOptions,
          unrealizedPnL: accountPnL
        });
      }
    }
    
    return {
      totalBalance,
      totalCash,
      totalEquities,
      totalOptions,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercentage: totalBalance > 0 ? (totalUnrealizedPnL / (totalBalance - totalUnrealizedPnL)) * 100 : 0,
      accountCount: accountsResponse.length,
      accounts: accountSummaries
    };
  } catch (error) {
    console.error('Error getting portfolio overview:', error);
    return { error: 'Failed to get portfolio overview.' };
  }
}
// src/app/actions/orchestration/portfolio-dashboard.ts
'use server';

import { getUserHoldings } from '../data-sources/snaptrade/positions';
import { getSnapTradeAccounts } from '../data-sources/snaptrade/accounts';
import { generatePortfolioSummary } from '../core/portfolio-calculations';

// Helper to ensure account property is present
function normalizeHoldingsData(holdings: any, accountId?: string): any {
  return {
    ...holdings,
    account: holdings.account ?? (accountId ? { id: accountId } : {})
  };
}

// Main portfolio analytics function
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

// Portfolio overview across all accounts
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
        const summary = generatePortfolioSummary(normalizedHoldings);
        
        totalBalance += summary.totalBalance;
        totalCash += summary.cashBalance;
        totalEquities += summary.assetBalances.equities;
        totalOptions += summary.assetBalances.options;
        totalUnrealizedPnL += summary.unrealizedPnL.total;
        
        accountSummaries.push({
          accountId: account.id,
          accountName: account.name,
          balance: summary.totalBalance,
          cash: summary.cashBalance,
          equities: summary.assetBalances.equities,
          options: summary.assetBalances.options,
          unrealizedPnL: summary.unrealizedPnL.total
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
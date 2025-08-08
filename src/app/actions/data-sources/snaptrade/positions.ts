// src/app/actions/data-sources/snaptrade/positions.ts
'use server';

import { snaptrade } from './client';

// ==================== POSITIONS FUNCTIONS ====================

export async function getSnapTradePositions(
  snaptradeUserId: string, 
  userSecret: string, 
  accountId?: string
) {
  try {
    if (accountId) {
      const positionsResponse = await snaptrade.accountInformation.getUserAccountPositions({
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: accountId,
      });
      return positionsResponse.data;
    } else {
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
      
      let allPositions: any[] = [];
      for (const account of accountsResponse.data) {
        const positionsResponse = await snaptrade.accountInformation.getUserAccountPositions({
          userId: snaptradeUserId,
          userSecret: userSecret,
          accountId: account.id,
        });
        if (positionsResponse.data) {
          allPositions = allPositions.concat(positionsResponse.data);
        }
      }
      return allPositions;
    }
  } catch (error) {
    console.error('Error fetching positions:', error);
    return { error: 'Failed to fetch positions.' };
  }
}

// ==================== HOLDINGS FUNCTIONS ====================

export async function getUserHoldings(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    if (accountId) {
      const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: accountId,
      });
      return holdingsResponse.data;
    } else {
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });

      const allHoldings = {
        account: null,
        balances: [] as any[],
        positions: [] as any[],
        option_positions: [] as any[],
        orders: [] as any[],
        total_value: { value: 0, currency: 'USD' }
      };

      let totalValue = 0;

      for (const account of accountsResponse.data) {
        const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
          userId: snaptradeUserId,
          userSecret: userSecret,
          accountId: account.id,
        });

        if (holdingsResponse.data) {
          const holdings = holdingsResponse.data;
          allHoldings.balances = allHoldings.balances.concat(holdings.balances || []);
          allHoldings.positions = allHoldings.positions.concat(holdings.positions || []);
          allHoldings.option_positions = allHoldings.option_positions.concat(holdings.option_positions || []);
          allHoldings.orders = allHoldings.orders.concat(holdings.orders || []);
          totalValue += holdings.total_value?.value || 0;
        }
      }

      allHoldings.total_value.value = totalValue;
      return allHoldings;
    }
  } catch (error) {
    console.error('Error fetching holdings:', error);
    return { error: 'Failed to fetch holdings.' };
  }
}

// ==================== AGGREGATED DATA FUNCTIONS ====================

export async function getAllPositions(
  snaptradeUserId: string, 
  userSecret: string, 
  accountId?: string
) {
  try {
    const holdings = await getUserHoldings(snaptradeUserId, userSecret, accountId);
    
    if ('error' in holdings) {
      return holdings;
    }

    return (holdings.positions || []).concat(holdings.option_positions || []);
  } catch (error) {
    console.error('Error fetching all positions:', error);
    return { error: 'Failed to fetch all positions.' };
  }
}
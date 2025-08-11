'use server';

import { snaptrade } from './snaptrade-client';

export async function testSnapTradeConnection(snaptradeUserId: string, userSecret: string) {
  try {
    console.log('Testing SnapTrade connection...');
    
    // Test 1: List accounts
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: snaptradeUserId,
      userSecret: userSecret
    });
    
    console.log(`Found ${accountsResponse.data?.length || 0} accounts`);
    
    if (!accountsResponse.data || accountsResponse.data.length === 0) {
      return {
        success: false,
        error: 'No accounts found',
        step: 'accounts'
      };
    }
    
    // Test 2: Get holdings for first account
    const firstAccount = accountsResponse.data[0];
    console.log('Testing holdings for account:', firstAccount.id);
    
    const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
      userId: snaptradeUserId,
      userSecret: userSecret,
      accountId: firstAccount.id
    });
    
    console.log(`Holdings test completed - found ${holdingsResponse.data?.positions?.length || 0} positions`);
    
    return {
      success: true,
      data: {
        accountsCount: accountsResponse.data.length,
        accounts: accountsResponse.data.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          institution: acc.institution_name
        })),
        firstAccountHoldings: holdingsResponse.data,
        hasPositions: holdingsResponse.data?.positions?.length || 0
      }
    };
    
  } catch (error) {
    console.error('SnapTrade connection test failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error,
      step: 'connection'
    };
  }
}
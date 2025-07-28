// src/app/actions/snaptrade.ts
'use server';
import { db } from '@/lib/firebase-admin';
import { Snaptrade } from "snaptrade-typescript-sdk";
import { UserIDandSecret, Balance, Account } from "snaptrade-typescript-sdk";

// Initialize Snaptrade
export const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID || '',
  consumerKey: process.env.SNAPTRADE_SECRET || '',
});

// ==================== AUTHENTICATION & USER MANAGEMENT ====================

export async function getSnapTradeLoginUrl(firebaseUserId: string) {
  console.log('Firebase User ID:', firebaseUserId);

  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const secret = process.env.SNAPTRADE_SECRET;

  if (!clientId || !secret) {
    console.error('SnapTrade credentials are not set.');
    return { error: 'Server configuration error.' };
  }

  try {
    // Check if user already exists in SnapTrade
    const userListResponse = await snaptrade.authentication.listSnapTradeUsers();
    const existingUserInSnapTrade = userListResponse.data.find((userIdString: string) => userIdString === firebaseUserId);

    let userSecretToUse = null;
    let snaptradeUserIdToUse = null;

    if (existingUserInSnapTrade) {
      console.log(`SnapTrade user with ID ${firebaseUserId} already exists.`);
      const firestoreCredentials = await getSnapTradeCredentials(firebaseUserId);
      
      if (firestoreCredentials) {
        snaptradeUserIdToUse = firestoreCredentials.snaptradeUserId;
        userSecretToUse = firestoreCredentials.userSecret;
        console.log('SnapTrade credentials found in Firestore.');
      } else {
        console.log('SnapTrade credentials not found in Firestore. Re-registering...');
        const registerResponse = await snaptrade.authentication.registerSnapTradeUser({
          userId: firebaseUserId
        });

        const registrationData = registerResponse.data as UserIDandSecret;
        if (!registrationData || !registrationData.userId || !registrationData.userSecret) {
          console.error('SnapTrade re-registration failed');
          return { error: 'Failed to re-register user with SnapTrade.' };
        }

        snaptradeUserIdToUse = registrationData.userId;
        userSecretToUse = registrationData.userSecret;

        await saveSnapTradeCredentials(firebaseUserId, registrationData);
      }
    } else {
      // Register new user
      console.log(`Registering new SnapTrade user: ${firebaseUserId}`);
      const registerResponse = await snaptrade.authentication.registerSnapTradeUser({
        userId: firebaseUserId
      });

      const registrationData = registerResponse.data as UserIDandSecret;
      if (!registrationData || !registrationData.userId || !registrationData.userSecret) {
        console.error('SnapTrade registration failed');
        return { error: 'Failed to register user with SnapTrade.' };
      }

      snaptradeUserIdToUse = registrationData.userId;
      userSecretToUse = registrationData.userSecret;

      await saveSnapTradeCredentials(firebaseUserId, registrationData);
    }

    // Get redirect URL
    if (!userSecretToUse || !snaptradeUserIdToUse) {
      console.error('User credentials missing');
      return { error: 'User credentials missing.' };
    }

    const loginResponse = await snaptrade.authentication.loginSnapTradeUser({
      userId: snaptradeUserIdToUse,
      userSecret: userSecretToUse,
      immediateRedirect: true,
      connectionPortalVersion: "v4",
      customRedirect: process.env.SNAPTRADE_REDIRECT_URI,
    });

    if (loginResponse.data && 'redirectURI' in loginResponse.data) {
      return { data: { redirectUrl: (loginResponse.data as any).redirectURI } };
    }

    return { error: 'Failed to get SnapTrade login URL.' };

  } catch (error) {
    console.error('SnapTrade process error:', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

export async function getSnapTradeCredentials(firebaseUserId: string) {
  try {
    const userDoc = await db.collection('snaptrade_users').doc(firebaseUserId).get();

    if (userDoc.exists) {
      const data = userDoc.data();
      const snaptradeUserId = data?.snaptradeUserID;
      const userSecret = data?.snaptradeUserSecret;

      if (snaptradeUserId && userSecret) {
        return {
          snaptradeUserId,
          userSecret,
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting SnapTrade credentials:', error);
    return null;
  }
}

async function saveSnapTradeCredentials(firebaseUserId: string, credentials: UserIDandSecret) {
  try {
    await db.collection('snaptrade_users').doc(firebaseUserId).set({
      snaptradeUserID: credentials.userId,
      snaptradeUserSecret: credentials.userSecret,
      snaptradeRegisteredAt: new Date().toISOString(),
    }, { merge: true });
    console.log('SnapTrade credentials stored in Firestore.');
  } catch (error) {
    console.error('Failed to store SnapTrade credentials:', error);
  }
}

// ==================== ACCOUNT FUNCTIONS ====================

export async function getSnapTradeAccounts(
  snaptradeUserId: string, 
  userSecret: string
): Promise<Account[] | { error: string }> {
  try {
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    return accountsResponse.data;
  } catch (error) {
    console.error("Error fetching SnapTrade accounts:", error);
    return { error: "Failed to fetch SnapTrade accounts." };
  }
}

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
      // Get all accounts and aggregate positions
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

// ==================== BALANCES FUNCTIONS ====================

export async function getSnapTradeBalances(
  snaptradeUserId: string, 
  userSecret: string, 
  accountId?: string
): Promise<Balance[] | { error: string }> {
  try {
    if (accountId) {
      const balancesResponse = await snaptrade.accountInformation.getUserAccountBalance({
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: accountId,
      });
      return balancesResponse.data;
    } else {
      // Get all accounts and aggregate balances
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
      
      let allBalances: Balance[] = [];
      for (const account of accountsResponse.data) {
        const balancesResponse = await snaptrade.accountInformation.getUserAccountBalance({
          userId: snaptradeUserId,
          userSecret: userSecret,
          accountId: account.id,
        });
        if (balancesResponse.data && Array.isArray(balancesResponse.data)) {
          allBalances = allBalances.concat(balancesResponse.data);
        }
      }
      
      // Aggregate balances by currency
      const aggregatedBalances: { [key: string]: { cash: number, buying_power: number } } = {};
      for (const balance of allBalances) {
        if (balance.currency?.code) {
          const currencyCode = balance.currency.code;
          if (!aggregatedBalances[currencyCode]) {
            aggregatedBalances[currencyCode] = { cash: 0, buying_power: 0 };
          }
          aggregatedBalances[currencyCode].cash += balance.cash || 0;
          aggregatedBalances[currencyCode].buying_power += balance.buying_power || 0;
        }
      }
      
      return Object.keys(aggregatedBalances).map(currencyCode => ({
        currency: { code: currencyCode, name: currencyCode, id: currencyCode },
        cash: aggregatedBalances[currencyCode].cash,
        buying_power: aggregatedBalances[currencyCode].buying_power,
      }));
    }
  } catch (error) {
    console.error('Error fetching balances:', error);
    return { error: 'Failed to fetch balances.' };
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
      // Get holdings for all accounts
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });

      // Aggregate holdings from all accounts
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

    // Combine equity and option positions
    return (holdings.positions || []).concat(holdings.option_positions || []);
  } catch (error) {
    console.error('Error fetching all positions:', error);
    return { error: 'Failed to fetch all positions.' };
  }
}
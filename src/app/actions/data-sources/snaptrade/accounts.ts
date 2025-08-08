// src/app/actions/data-sources/snaptrade/accounts.ts
'use server';

import { UserIDandSecret, Balance, Account } from "snaptrade-typescript-sdk";
import { snaptrade } from './client';
import { db } from '@/lib/firebase-admin';

// ==================== AUTHENTICATION & USER MANAGEMENT ====================

export async function getSnapTradeLoginUrl(firebaseUserId: string) {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const secret = process.env.SNAPTRADE_SECRET;

  if (!clientId || !secret) {
    console.error('SnapTrade credentials are not set.');
    return { error: 'Server configuration error.' };
  }

  try {
    console.log('Checking for existing SnapTrade credentials in Firestore...');
    
    const firestoreCredentials = await getSnapTradeCredentials(firebaseUserId);
    
    let userSecretToUse: string;
    let snaptradeUserIdToUse: string;

    if (firestoreCredentials && firestoreCredentials.userSecret) {
      snaptradeUserIdToUse = firestoreCredentials.snaptradeUserId;
      userSecretToUse = firestoreCredentials.userSecret;
      console.log('Using existing SnapTrade credentials from Firestore.');
    } else {
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
      console.log('New SnapTrade user registered and credentials saved.');
    }

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
    
    if (error instanceof Error && error.message.includes('ENOTFOUND api.snaptrade.com')) {
      console.error('Cannot connect to SnapTrade API - network issue');
      return { 
        error: 'Unable to connect to SnapTrade API. This may be a temporary network issue. Please check your internet connection and try again in a few minutes.' 
      };
    }
    
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

export async function getSnapTradeCredentials(firebaseUserId: string) {
  try {
    console.log(`Querying Firestore for user: ${firebaseUserId}`);
    const userDoc = await db.collection('snaptrade_users').doc(firebaseUserId).get();
    
    console.log(`Document exists: ${userDoc.exists}`);
    
    if (userDoc.exists) {
      const data = userDoc.data();
      console.log('Full document data:', JSON.stringify(data, null, 2));
      
      const snaptradeUserId = firebaseUserId;
      const userSecret = data?.snaptradeUserSecret;
      
      console.log(`snaptradeUserID: ${snaptradeUserId} (using Firebase UID)`);
      console.log(`snaptradeUserSecret: ${userSecret ? '[PRESENT]' : '[MISSING]'}`);
      
      if (userSecret) {
        return { snaptradeUserId, userSecret };
      } else {
        console.log('SnapTrade user secret missing in Firestore document');
      }
    } else {
      console.log('User document does not exist in snaptrade_users collection');
    }
    return null;
  } catch (error) {
    console.error('Error getting SnapTrade credentials:', error);
    return null;
  }
}

async function saveSnapTradeCredentials(firebaseUserId: string, credentials: UserIDandSecret) {
  try {
    const userRef = db.collection('snaptrade_users').doc(firebaseUserId);
    await userRef.update({
      SnaptradeUserID: firebaseUserId,
      snaptradeUserSecret: credentials.userSecret,
      snaptradeRegisteredAt: new Date().toISOString(),
    });
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
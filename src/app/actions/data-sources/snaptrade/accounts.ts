// src/app/actions/data-sources/snaptrade/accounts.ts
'use server';

import { UserIDandSecret, Balance, Account } from "snaptrade-typescript-sdk";
import { snaptrade } from './client';
import { db } from '@/lib/firebase-admin';

// ==================== AUTHENTICATION & USER MANAGEMENT ====================

export async function getSnapTradeLoginUrl(firebaseUserId: string, redirectUrl?: string) {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const secret = process.env.SNAPTRADE_SECRET;

  if (!clientId || !secret) {
    console.error('SnapTrade credentials are not set.');
    return { error: 'Server configuration error.' };
  }

  try {
    console.log('Checking for existing SnapTrade credentials...');
    
    // This function now securely fetches the secret from a server-only collection.
    const firestoreCredentials = await getSnapTradeCredentials(firebaseUserId);
    
    let userSecretToUse: string;
    let snaptradeUserIdToUse: string = firebaseUserId; // SnapTrade User ID is the same as Firebase UID

    if (firestoreCredentials && firestoreCredentials.userSecret) {
      userSecretToUse = firestoreCredentials.userSecret;
      console.log('Using existing SnapTrade credentials from secure storage.');
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

      userSecretToUse = registrationData.userSecret;

      // This function now securely saves the credentials to their respective collections.
      await saveSnapTradeCredentials(firebaseUserId, registrationData);
      console.log('New SnapTrade user registered and credentials saved securely.');
    }

    if (!userSecretToUse) {
      console.error('User secret missing');
      return { error: 'User secret missing.' };
    }

    const loginResponse = await snaptrade.authentication.loginSnapTradeUser({
      userId: snaptradeUserIdToUse,
      userSecret: userSecretToUse,
      immediateRedirect: true,
      connectionPortalVersion: "v4",
      customRedirect: redirectUrl || process.env.SNAPTRADE_REDIRECT_URI,
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

/**
 * Securely retrieves the user's SnapTrade secret from the server-only collection.
 */
export async function getSnapTradeCredentials(firebaseUserId: string): Promise<{ snaptradeUserId: string; userSecret: string } | null> {
  try {
    console.log(`Querying secure storage for user secret: ${firebaseUserId}`);
    const secretDoc = await db.collection('snaptrade_user_secrets').doc(firebaseUserId).get();
    
    if (secretDoc.exists) {
      const data = secretDoc.data();
      const userSecret = data?.secret;
      
      if (userSecret) {
        console.log('User secret found in secure storage.');
        // The snaptradeUserId is always the same as the firebaseUserId in our setup.
        return { snaptradeUserId: firebaseUserId, userSecret };
      } else {
        console.log('User secret is missing from the secret document.');
      }
    } else {
      console.log('User secret document does not exist.');
    }
    return null;
  } catch (error) {
    console.error('Error getting SnapTrade credentials from secure storage:', error);
    return null;
  }
}

/**
 * Securely retrieves all SnapTrade credentials for a cron job or other backend process.
 * This should only be used in a secure server-side environment.
 */
export async function getAllSnapTradeCredentials() {
  try {
    console.log('Querying secure storage for all user secrets...');
    const secretsSnapshot = await db.collection('snaptrade_user_secrets').get();
    
    const users: Array<{firebaseUserId: string, snaptradeUserId: string, userSecret: string}> = [];
    
    secretsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      const userSecret = data?.secret;
      
      if (userSecret) {
        users.push({
          firebaseUserId: doc.id,
          snaptradeUserId: doc.id, // Using Firebase UID as SnapTrade user ID
          userSecret
        });
      }
    });
    
    console.log(`Found ${users.length} users with SnapTrade credentials.`);
    return users;
  } catch (error) {
    console.error('Error getting all SnapTrade credentials from secure storage:', error);
    return [];
  }
}

/**
 * Securely saves SnapTrade credentials.
 * The public SnapTrade User ID is stored in 'snaptrade_users'.
 * The private userSecret is stored in the server-only 'snaptrade_user_secrets' collection.
 */
async function saveSnapTradeCredentials(firebaseUserId: string, credentials: UserIDandSecret) {
  try {
    // 1. Store the public-facing data in the main user document.
    const userRef = db.collection('snaptrade_users').doc(firebaseUserId);
    await userRef.set({
      SnaptradeUserID: credentials.userId, // Storing the ID is fine
      snaptradeRegisteredAt: new Date().toISOString(),
    }, { merge: true }); // Use merge to avoid overwriting other user fields

    // 2. Store the sensitive secret in the secure, server-only collection.
    const secretRef = db.collection('snaptrade_user_secrets').doc(firebaseUserId);
    await secretRef.set({
      secret: credentials.userSecret,
    });

    console.log('SnapTrade credentials stored securely.');

    // Trigger immediate data sync after successful registration
    try {
      console.log('Triggering initial data sync for new user...');
      await triggerInitialDataSync(firebaseUserId, credentials);
    } catch (syncError) {
      console.error('Initial data sync failed, but registration was successful:', syncError);
      // Don't fail the registration if sync fails
    }
  } catch (error) {
    console.error('Failed to store SnapTrade credentials securely:', error);
  }
}

/**
 * Triggers initial data sync after successful SnapTrade registration.
 * This populates Firestore with user's holdings, positions, and trade activities.
 */
async function triggerInitialDataSync(firebaseUserId: string, credentials: UserIDandSecret) {
  try {
    // Import the sync service
    const { SnapTradeFirestoreSync } = await import('@/lib/snaptrade-firestore-sync');
    
    const snapTradeCredentials = {
      userId: firebaseUserId,
      snaptradeUserId: credentials.userId,
      userSecret: credentials.userSecret
    };

    console.log('Starting initial full sync for new user...');
    console.log('Sync credentials:', { 
      userId: snapTradeCredentials.userId, 
      hasSnaptradeUserId: !!snapTradeCredentials.snaptradeUserId, 
      hasUserSecret: !!snapTradeCredentials.userSecret 
    });
    
    // Run full sync to populate all data
    const syncResult = await SnapTradeFirestoreSync.fullSync(snapTradeCredentials);
    
    console.log('Sync result:', syncResult);
    
    if (syncResult.success) {
      console.log(`Initial sync completed successfully: ${syncResult.positions} positions, ${syncResult.trades} trades`);
      
      // Update user document with sync timestamp
      const userRef = db.collection('snaptrade_users').doc(firebaseUserId);
      await userRef.update({
        initialSyncCompleted: true,
        initialSyncCompletedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString()
      });
      
    } else {
      console.error('Initial sync failed:', syncResult.error);
      throw new Error(syncResult.error);
    }
    
  } catch (error) {
    console.error('Error in triggerInitialDataSync:', error);
    throw error;
  }
}

// ==================== ACCOUNT FUNCTIONS ====================
// (No changes needed below this line for the security fix)

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

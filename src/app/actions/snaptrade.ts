// src/app/actions/snaptrade.ts
'use server';
import { db } from '@/lib/firebase-admin';
import { Snaptrade } from "snaptrade-typescript-sdk";
import { UserIDandSecret, AuthenticationLoginSnapTradeUser200Response, EncryptedResponse, AccountHoldingsAccount, Balance, Account } from "snaptrade-typescript-sdk";

// Add this type for the SnapTrade registration response
interface SnapTradeRegistrationSuccessResponse extends UserIDandSecret {
  // Add any other properties present in a successful registration response
}

// Correcting LoginRedirectURI based on the error output
interface LoginRedirectURI {
  redirectURI: string; // Corrected property name
  sessionId?: string; // Added sessionId based on output
  // Add any other properties present in LoginRedirectURI
}

// Initialize Snaptrade - make sure to use environment variables
const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID || '',
  consumerKey: process.env.SNAPTRADE_SECRET || '',
});


export async function getSnapTradeLoginUrl(firebaseUserId: string) {
  console.log('Firebase User ID:', firebaseUserId);

  const snaptradeAPI = 'https://api.snaptrade.com/api/v1';
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const secret = process.env.SNAPTRADE_SECRET;

  if (!clientId || !secret) {
    console.error('SnapTrade credentials are not set.');
    return { error: 'Server configuration error.' };
  }

  try {
    // 1. Check if user already exists in SnapTrade
    const userListResponse = await snaptrade.authentication.listSnapTradeUsers();
    console.log('SnapTrade Users:', userListResponse.data);
    const existingUserInSnapTrade = userListResponse.data.find((userIdString: string) => userIdString === firebaseUserId);

    let userSecretToUse = null;
    let snaptradeUserIdToUse = null; // Variable to store the snaptradeUserId

    if (existingUserInSnapTrade) {
      console.log(`SnapTrade user with ID ${firebaseUserId} already exists.`);
      // Try to get credentials from Firestore (from the correct collection and with correct casing)
      const firestoreCredentials = await getSnapTradeCredentials(firebaseUserId);
      if (firestoreCredentials) {
        snaptradeUserIdToUse = firestoreCredentials.snaptradeUserId; // Get snaptradeUserId
        userSecretToUse = firestoreCredentials.userSecret; // Get snaptradeUserSecret
        console.log('SnapTrade credentials found in Firestore.');
      } else {
        console.log('SnapTrade credentials not found in Firestore. Re-registering with SnapTrade...');
        // If credentials not in Firestore, re-register to get a new userSecret
        // Use SDK function for registration as well for consistency
        const registerResponse = await snaptrade.authentication.registerSnapTradeUser({
          userId: firebaseUserId
        });

        // Assuming successful registration response directly contains userId and userSecret
        // If the SDK throws an error on failure, the catch block will handle it.
        const registrationData = registerResponse.data as UserIDandSecret; // Cast to UserIDandSecret

        if (!registrationData || !registrationData.userId || !registrationData.userSecret) {
             console.error('SnapTrade re-registration failed: Invalid response data', registerResponse.data);
             return { error: 'Failed to re-register user with SnapTrade: Invalid response.' };
        }

        snaptradeUserIdToUse = registrationData.userId; // Get snaptradeUserId from registration
        userSecretToUse = registrationData.userSecret; // Get snaptradeUserSecret from registration

        // Store the new userSecret in Firestore (in the correct collection and with correct casing)
        try {
          await db.collection('snaptrade_users').doc(firebaseUserId).set({
            snaptradeUserID: registrationData.userId, // Corrected casing
            snaptradeUserSecret: registrationData.userSecret, // Corrected casing
            snaptradeRegisteredAt: new Date().toISOString(), // Update registration time
          }, { merge: true });
          console.log('Newly obtained SnapTrade credentials stored in Firestore.');
        } catch (firestoreError) {
          console.error('Failed to store newly obtained SnapTrade credentials:', firestoreError);
          // Decide how to handle this error - proceed without storing or return error?
        }
      }
    }

    // User does not exist in SnapTrade, register them for the first time
    if (!existingUserInSnapTrade) { // Moved this block inside the else for clarity
      console.log(`SnapTrade user with ID ${firebaseUserId} not found, registering...`);
      // Use SDK function for initial registration
      const registerResponse = await snaptrade.authentication.registerSnapTradeUser({
        userId: firebaseUserId
      });

       // Assuming successful registration response directly contains userId and userSecret
        // If the SDK throws an error on failure, the catch block will handle it.
      const registrationData = registerResponse.data as UserIDandSecret; // Cast to UserIDandSecret

      if (!registrationData || !registrationData.userId || !registrationData.userSecret) {
          console.error('SnapTrade initial registration failed: Invalid response data', registerResponse.data);
          return { error: 'Failed to register user with SnapTrade: Invalid response.' };
       }

      snaptradeUserIdToUse = registrationData.userId; // Get snaptradeUserId from registration
      userSecretToUse = registrationData.userSecret; // Get snaptradeUserSecret from registration

      // Store the userSecret in Firestore (only for new users - in the correct collection and with correct casing)
      try {
        await db.collection('snaptrade_users').doc(firebaseUserId).set({
          snaptradeUserID: registrationData.userId, // Corrected casing
          snaptradeUserSecret: registrationData.userSecret,
          snaptradeRegisteredAt: new Date().toISOString(),
        }, { merge: true });
        console.log('Initial SnapTrade credentials stored in Firestore.');
      } catch (firestoreError) {
        console.error('Failed to store initial SnapTrade credentials:', firestoreError);
        // Decide how to handle this error - proceed without storing or return error?
      }
    }

    // 4. Get the redirect URL using the obtained userSecret and snaptradeUserId
    if (!userSecretToUse || !snaptradeUserIdToUse) {
        console.error('User secret or SnapTrade User ID not available to get login URL.');
        return { error: 'User credentials or SnapTrade User ID missing.' };
    }

    // Use the SDK function for login
    const loginResponse = await snaptrade.authentication.loginSnapTradeUser({
      userId: snaptradeUserIdToUse, // Use snaptradeUserId here
      userSecret: userSecretToUse,
      immediateRedirect: true,
      connectionPortalVersion: "v4", // Specify connection portal version
      customRedirect: process.env.SNAPTRADE_REDIRECT_URI,
    });

    // Check if the response has the redirectURI property
    if (loginResponse.data && typeof loginResponse.data === 'object' && 'redirectURI' in loginResponse.data) {
      const loginData = loginResponse.data as LoginRedirectURI; // Cast to LoginRedirectURI
      return { data: { redirectUrl: loginData.redirectURI } }; // Access redirectURI
    } else {
        // Handle the case where the response is not a LoginRedirectURI
        console.error('SnapTrade login URL request failed: Unexpected response type', loginResponse.data);
         // It's possible that error responses have a different structure
         // If the SDK throws an error on failure, the catch block will handle it.
        return { error: 'Failed to get SnapTrade login URL: Unexpected response.' };
    }

  } catch (error) {
    console.error('An error occurred during SnapTrade process:', error);
     // Attempt to extract error message if it's an object with a message property
    if (error !== null && typeof error === 'object' && 'message' in error) {
        return { error: error.message as string };
    } else {
        return { error: 'An unexpected error occurred.' };
    }
  }
}

async function getSnapTradeCredentials(firebaseUserId: string) {
  try {
    console.log('Attempting to get SnapTrade credentials for user:', firebaseUserId); // Added log
    const userDoc = await db.collection('snaptrade_users').doc(firebaseUserId).get();

    if (userDoc.exists) {
      console.log('Firestore document found.'); // Added log
      const data = userDoc.data();
      console.log('Firestore document data:', data); // Added log

      // Access with correct casing
      const snaptradeUserId = data?.snaptradeUserID;
      const userSecret = data?.snaptradeUserSecret;

      console.log('Retrieved snaptradeUserId:', snaptradeUserId); // Added log
      console.log('Retrieved userSecret:', userSecret); // Added log

      if (snaptradeUserId && userSecret) {
        console.log('SnapTrade credentials successfully retrieved.'); // Added log
        return {
          snaptradeUserId: snaptradeUserId,
          userSecret: userSecret,
        };
      } else {
        console.error('SnapTrade credentials missing or incomplete in Firestore for user:', firebaseUserId); // Modified log
        return null;
      }
    }
     else {
      console.error('SnapTrade document not found in Firestore for user:', firebaseUserId); // Added log
      return null;
    }
  } catch (error) {
    console.error('Error getting SnapTrade credentials from Firestore:', error); // Added log
    return null;
  }
}

export async function getSnapTradeAccounts(firebaseUserId: string, snaptradeUserId: string, userSecret: string) {
  try {
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({ // Corrected
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    // No need to store account IDs in Firestore here. We will fetch them every time
    // the dashboard loads to ensure we have the most up-to-date list.
    // await db.collection('users').doc(firebaseUserId).set({
    //   snaptradeAccountIds: accountIds,
    // }, { merge: true });

    console.log('SnapTrade accounts fetched.');

    return accountsResponse.data;
  } catch (error) {
    console.error("Error fetching SnapTrade accounts:", error);
    // Return a consistent error structure
    return { error: "Failed to fetch SnapTrade accounts." };
  }
}


export async function getSnapTradePositions(snaptradeUserId: string, userSecret: string, accountId?: string) {
  try {
    if (accountId) {
      // Fetch positions for a single account
      const positionsResponse = await snaptrade.accountInformation.getUserAccountPositions({ // Corrected
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: accountId,
      });
      // Check for error response from SDK function
      if ((positionsResponse.data as any)?.error) {
         return { error: (positionsResponse.data as any).error };
      }
      return positionsResponse.data;
    } else {
      // Fetch positions for all accounts and aggregate
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
       // Check for error response from SDK function
      if ((accountsResponse.data as any)?.error) {
         return { error: (accountsResponse.data as any).error };
      }
      const allAccounts = accountsResponse.data;
      let allPositions: any[] = [];

      for (const account of allAccounts) {
        const positionsResponse = await snaptrade.accountInformation.getUserAccountPositions({
          userId: snaptradeUserId,
          userSecret: userSecret,
          accountId: account.id,
        });
         // Only add data if it exists and is not an error
        if (positionsResponse.data && !(positionsResponse.data as any)?.error) {
          allPositions = allPositions.concat(positionsResponse.data);
        }
      }
      return allPositions;
    }
  } catch (error) {
    console.error(`Error fetching SnapTrade positions${accountId ? ` for account ${accountId}` : ''}:`, error);
     // Return a consistent error structure
    return { error: `Failed to fetch SnapTrade positions${accountId ? ` for account ${accountId}` : ''}.` };
  }
}

export async function getSnapTradeBalances(snaptradeUserId: string, userSecret: string, accountId?: string) {
  try {
    if (accountId) {
      // Fetch balances for a single account
      const balancesResponse = await snaptrade.accountInformation.getUserAccountBalance({ // New function for balances
        userId: snaptradeUserId,
        userSecret: userSecret,
        accountId: accountId,
      });
      // Check for error response from SDK function
      if ((balancesResponse.data as any)?.error) {
         return { error: (balancesResponse.data as any).error };
      }
      return balancesResponse.data;
    } else {
      // Fetch balances for all accounts and aggregate
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
       // Check for error response from SDK function
      if ((accountsResponse.data as any)?.error) {
         return { error: (accountsResponse.data as any).error };
      }
      const allAccounts = accountsResponse.data;
      let allBalances: Balance[] = []; // Use Balance[] type

      for (const account of allAccounts) {
        const balancesResponse = await snaptrade.accountInformation.getUserAccountBalance({
          userId: snaptradeUserId,
          userSecret: userSecret,
          accountId: account.id,
        });
         // Only add data if it exists and is not an error, and is an array
        if (balancesResponse.data && !(balancesResponse.data as any)?.error && Array.isArray(balancesResponse.data)) {
          allBalances = allBalances.concat(balancesResponse.data);
        }
      }
      // Aggregate balances by currency
      const aggregatedBalances: { [key: string]: { cash: number, buying_power: number } } = {};
      for (const balance of allBalances) {
        // Check if currency and code are defined before accessing
        if (balance.currency?.code) {
           const currencyCode = balance.currency.code;
            if (!aggregatedBalances[currencyCode]) {
              aggregatedBalances[currencyCode] = { cash: 0, buying_power: 0 };
            }
            aggregatedBalances[currencyCode].cash += balance.cash || 0; // Handle potential null/undefined cash
            aggregatedBalances[currencyCode].buying_power += balance.buying_power || 0; // Handle potential null/undefined buying_power
        }
      }
      return Object.keys(aggregatedBalances).map(currencyCode => ({
        currency: { code: currencyCode, name: currencyCode }, // You might want to store currency names
        cash: aggregatedBalances[currencyCode].cash,
        buying_power: aggregatedBalances[currencyCode].buying_power,
      }));
    }
  } catch (error) {
    console.error(`Error fetching SnapTrade balances${accountId ? ` for account ${accountId}` : ''}:`, error);
    // Return a consistent error structure
    return { error: `Failed to fetch SnapTrade balances${accountId ? ` for account ${accountId}` : ''}.` };
  }
}

// Add new functions to get aggregated open equities, open options, and cash
export async function getOpenEquities(snaptradeUserId: string, userSecret: string, accountId?: string) {
  try {
    const allPositions = await getSnapTradePositions(snaptradeUserId, userSecret, accountId);
    // Check if allPositions is an array before filtering
    if (!Array.isArray(allPositions) || (allPositions as any).error) {
      return allPositions; // Return error or non-array result
    }
    // Filter for equity positions (assuming type 'cs' is common stock/equity)
    const equityPositions = allPositions.filter((position: any) => position.symbol?.symbol?.type?.code === 'cs');
    // You might want to aggregate the value of equity positions here if needed
    return equityPositions.length; // Returning count for now
  } catch (error) {
    console.error(`Error fetching open equities${accountId ? ` for account ${accountId}` : ''}:`, error);
     // Return a consistent error structure
    return { error: `Failed to fetch open equities${accountId ? ` for account ${accountId}` : ''}.` };
  }
}

export async function getOpenOptions(snaptradeUserId: string, userSecret: string, accountId?: string) {
  try {
     if (accountId) {
      // Fetch holdings for a single account to get option positions
      const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
         userId: snaptradeUserId,
         userSecret: userSecret,
         accountId: accountId,
      });
      // Check for error response from SDK function
      if ((holdingsResponse.data as any)?.error) {
         return { error: (holdingsResponse.data as any).error };
      }
      return holdingsResponse.data?.option_positions?.length || 0; // Return count of option positions
    } else {
       // Fetch holdings for all accounts and aggregate option positions
      const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
        userId: snaptradeUserId,
        userSecret: userSecret,
      });
       // Check for error response from SDK function
      if ((accountsResponse.data as any)?.error) {
         return { error: (accountsResponse.data as any).error };
      }
      const allAccounts = accountsResponse.data;
      let allOptionPositions = 0;

      for (const account of allAccounts) {
         const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
            userId: snaptradeUserId,
            userSecret: userSecret,
            accountId: account.id,
         });
          // Only add data if it exists and is not an error
         if (holdingsResponse.data && !(holdingsResponse.data as any)?.error) {
            allOptionPositions += holdingsResponse.data.option_positions?.length || 0; // Handle potential null/undefined option_positions
         }
      }
      return allOptionPositions;
    }
  } catch (error) {
    console.error(`Error fetching open options${accountId ? ` for account ${accountId}` : ''}:`, error);
     // Return a consistent error structure
    return { error: `Failed to fetch open options${accountId ? ` for account ${accountId}` : ''}.` };
  }
}

export async function getCash(snaptradeUserId: string, userSecret: string, accountId?: string) {
  try {
    const allBalances = await getSnapTradeBalances(snaptradeUserId, userSecret, accountId);
     // Check if allBalances is an array before proceeding
     if (!Array.isArray(allBalances) || (allBalances as any).error) {
        return allBalances; // Return error or non-array result
     }

    // Aggregate cash from all currencies
    let totalCash = 0;
    for (const balance of allBalances) {
       totalCash += balance.cash || 0; // Handle potential null/undefined cash
    }

    return totalCash;
  } catch (error) {
    console.error(`Error fetching cash${accountId ? ` for account ${accountId}` : ''}:`, error);
     // Return a consistent error structure
    return { error: `Failed to fetch cash${accountId ? ` for account ${accountId}` : ''}.` };
  }
}


// Add a function to get all positions (equities and options)
export async function getAllPositions(snaptradeUserId: string, userSecret: string, accountId?: string) {
    try {
        if (accountId) {
             const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
                userId: snaptradeUserId,
                userSecret: userSecret,
                accountId: accountId,
             });
              // Check for error response from SDK function
             if ((holdingsResponse.data as any)?.error) {
                return { error: (holdingsResponse.data as any).error };
             }
             // Combine equity and option positions, handling potential null/undefined
             return (holdingsResponse.data?.positions || []).concat(holdingsResponse.data?.option_positions || []);

        } else {
            const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
                userId: snaptradeUserId,
                userSecret: userSecret,
            });
             // Check for error response from SDK function
            if ((accountsResponse.data as any)?.error) {
                return { error: (accountsResponse.data as any).error };
            }
            const allAccounts = accountsResponse.data;
            let allPositions: any[] = [];

            for (const account of allAccounts) {
                const holdingsResponse = await snaptrade.accountInformation.getUserHoldings({
                    userId: snaptradeUserId,
                    userSecret: userSecret,
                    accountId: account.id,
                });
                 // Only add data if it exists and is not an error
                 if (holdingsResponse.data && !(holdingsResponse.data as any)?.error) {
                    allPositions = allPositions.concat(holdingsResponse.data.positions || []).concat(holdingsResponse.data.option_positions || []); // Handle potential null/undefined positions/option_positions
                }
            }
            return allPositions;
        }
    } catch (error) {
        console.error(`Error fetching all positions${accountId ? ` for account ${accountId}` : ''}:`, error);
         // Return a consistent error structure
        return { error: `Failed to fetch all positions${accountId ? ` for account ${accountId}` : ''}.` };
    }
}

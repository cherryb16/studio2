'use server';
import { db } from '@/lib/firebase-admin';
import { Snaptrade } from "snaptrade-typescript-sdk";
import { UserIDandSecret, AuthenticationLoginSnapTradeUser200Response, EncryptedResponse } from "snaptrade-typescript-sdk";

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

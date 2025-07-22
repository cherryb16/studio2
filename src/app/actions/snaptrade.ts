'use server';
import { db } from '@/lib/firebase-admin';
import { Snaptrade } from "snaptrade-typescript-sdk";

// Add this type for the SnapTrade registration response
interface SnapTradeRegistrationResponse {
  userId: string;
  userSecret: string;
  redirectUrl?: string;
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

    if (existingUserInSnapTrade) {
      console.log(`SnapTrade user with ID ${firebaseUserId} already exists.`);
      // Try to get credentials from Firestore
      const firestoreCredentials = await getSnapTradeCredentials(firebaseUserId);
      if (firestoreCredentials) {
        userSecretToUse = firestoreCredentials.userSecret;
        console.log('SnapTrade credentials found in Firestore.');
      } else {
        console.log('SnapTrade credentials not found in Firestore. Re-registering with SnapTrade...');
        // If credentials not in Firestore, re-register to get a new userSecret
        const registerResponse = await fetch(`${snaptradeAPI}/auth/registerUser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientId, secret: secret, userId: firebaseUserId }),
        });

        if (!registerResponse.ok) {
          const errorData = await registerResponse.json();
          console.error('SnapTrade re-registration failed:', errorData);
          return { error: errorData.message || 'Failed to re-register user with SnapTrade.' };
        }

        const registrationData: SnapTradeRegistrationResponse = await registerResponse.json();
        userSecretToUse = registrationData.userSecret;

        // Store the new userSecret in Firestore
        try {
          await db.collection('users').doc(firebaseUserId).set({
            snaptradeUserId: registrationData.userId,
            snaptradeUserSecret: registrationData.userSecret,
            snaptradeRegisteredAt: new Date().toISOString(), // Update registration time
          }, { merge: true });
          console.log('Newly obtained SnapTrade credentials stored in Firestore.');
        } catch (firestoreError) {
          console.error('Failed to store newly obtained SnapTrade credentials:', firestoreError);
          // Decide how to handle this error - proceed without storing or return error?
        }
      }
    } else {
      // User does not exist in SnapTrade, register them for the first time
      console.log(`SnapTrade user with ID ${firebaseUserId} not found, registering...`);
      const registerResponse = await fetch(`${snaptradeAPI}/auth/registerUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId, secret: secret, userId: firebaseUserId }),
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        console.error('SnapTrade initial registration failed:', errorData);
        return { error: errorData.message || 'Failed to register user with SnapTrade.' };
      }

      const registrationData: SnapTradeRegistrationResponse = await registerResponse.json();
      userSecretToUse = registrationData.userSecret;

      // Store the userSecret in Firestore (only for new users)
      try {
        await db.collection('users').doc(firebaseUserId).set({
          snaptradeUserId: registrationData.userId,
          snaptradeUserSecret: registrationData.userSecret,
          snaptradeRegisteredAt: new Date().toISOString(),
        }, { merge: true });
        console.log('Initial SnapTrade credentials stored in Firestore.');
      } catch (firestoreError) {
        console.error('Failed to store initial SnapTrade credentials:', firestoreError);
        // Decide how to handle this error - proceed without storing or return error?
      }
    }

    // 4. Get the redirect URL using the obtained userSecret
    if (!userSecretToUse) {
        console.error('User secret not available to get login URL.');
        return { error: 'User credentials missing.' };
    }

    const loginResponse = await fetch(`${snaptradeAPI}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId,
        secret: secret,
        userId: firebaseUserId,
        userSecret: userSecretToUse,
      }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.error('SnapTrade login URL request failed:', errorData);
      return { error: errorData.message || 'Failed to get SnapTrade login URL.' };
    }

    const loginData = await loginResponse.json();

    return { data: { redirectUrl: loginData.redirectUrl } };

  } catch (error) {
    console.error('An error occurred during SnapTrade process:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

async function getSnapTradeCredentials(firebaseUserId: string) {
  try {
    const userDoc = await db.collection('users').doc(firebaseUserId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return {
        userId: data?.snaptradeUserId,
        userSecret: data?.snaptradeUserSecret,
      };
    } else {
      console.error('SnapTrade credentials not found in Firestore for user:', firebaseUserId);
      return null;
    }
  } catch (error) {
    console.error('Error getting SnapTrade credentials from Firestore:', error);
    return null;
  }
}

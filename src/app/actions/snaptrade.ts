'use server';
import { db } from '@/lib/firebase-admin';

// Add this type for the SnapTrade registration response
interface SnapTradeRegistrationResponse {
  userId: string;
  userSecret: string;
}

export async function getSnapTradeLoginUrl(userId: string) {
  const snaptradeAPI = 'https://api.snaptrade.com/api/v1';
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const secret = process.env.SNAPTRADE_SECRET;

  if (!clientId || !secret) {
    console.error('SnapTrade credentials are not set.');
    return { error: 'Server configuration error.' };
  }

  try {
    // 1. Register User and capture the response
    const registerResponse = await fetch(`${snaptradeAPI}/auth/registerUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        secret: secret,
        userId: userId,
      }),
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json();
      return { error: errorData.message || 'Failed to register user with SnapTrade.' };
    }

    const registrationData: SnapTradeRegistrationResponse = await registerResponse.json();
    
    // 2. Store the userSecret in Firestore
    try {
      await db.collection('users').doc(userId).set({
        snaptradeUserId: registrationData.userId,
        snaptradeUserSecret: registrationData.userSecret,
        snaptradeRegisteredAt: new Date().toISOString(),
      }, { merge: true });
    } catch (firestoreError) {
      console.error('Failed to store SnapTrade credentials:', firestoreError);
      return { error: 'Failed to store user credentials.' };
    }

    // 3. Get Login Link using the userSecret
    const loginResponse = await fetch(`${snaptradeAPI}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        secret: secret,
        userId: registrationData.userId,
        userSecret: registrationData.userSecret,
      }),
    });

    const loginData = await loginResponse.json();
    if (loginResponse.ok) {
      return { url: loginData.redirectURI };
    } else {
      return { error: loginData.message || 'Failed to get login link.' };
    }
  } catch (error) {
    console.error('SnapTrade integration error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

// Helper function to retrieve stored SnapTrade credentials
export async function getSnapTradeCredentials(userId: string) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    const userData = userDoc.data();
    
    if (!userData?.snaptradeUserId || !userData?.snaptradeUserSecret) {
      return null;
    }
    
    return {
      userId: userData.snaptradeUserId,
      userSecret: userData.snaptradeUserSecret,
    };
  } catch (error) {
    console.error('Failed to retrieve SnapTrade credentials:', error);
    return null;
  }
}

// Example function for making authenticated SnapTrade API calls
export async function getSnapTradeAccounts(firebaseUserId: string) {
  const snaptradeAPI = 'https://api.snaptrade.com/api/v1';
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const secret = process.env.SNAPTRADE_SECRET;
  
  // Get stored user credentials
  const credentials = await getSnapTradeCredentials(firebaseUserId);
  
  if (!credentials) {
    return { error: 'User not registered with SnapTrade or credentials not found.' };
  }
  
  try {
    const response = await fetch(`${snaptradeAPI}/accounts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        secret: secret,
        userId: credentials.userId,
        userSecret: credentials.userSecret,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { accounts: data };
    } else {
      return { error: data.message || 'Failed to fetch accounts.' };
    }
  } catch (error) {
    console.error('SnapTrade API error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

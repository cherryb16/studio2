// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Debug logging
console.log('Firebase Config Check:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  hasStorageBucket: !!firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId,
});

let app: FirebaseApp;
let auth: any;
let db: any;

// Check if all required environment variables are defined
const hasAllConfig = Object.values(firebaseConfig).every(Boolean);

if (hasAllConfig) {
  console.log('Firebase: Initializing with full config');
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.error("Firebase config is missing or incomplete. Firebase will not be initialized.");
  console.error("Missing config keys:", Object.entries(firebaseConfig)
    .filter(([key, value]) => !value)
    .map(([key]) => key)
  );
  
  // For now, let's provide a fallback instead of throwing to prevent build errors
  console.warn('Using fallback Firebase configuration for development');
  app = !getApps().length ? initializeApp({
    apiKey: "dummy",
    authDomain: "dummy.firebaseapp.com",
    projectId: "dummy",
    storageBucket: "dummy.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:dummy"
  }) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: any;

// Check if all required environment variables are defined
const hasAllConfig = Object.values(firebaseConfig).every(Boolean);

if (hasAllConfig) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
} else {
  console.error("Firebase config is missing or incomplete. Firebase will not be initialized.");
  console.error("Missing config keys:", Object.entries(firebaseConfig)
    .filter(([key, value]) => !value)
    .map(([key]) => key)
  );
  
  // Create a minimal mock auth object that won't crash the app
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {}, // Returns an unsubscribe function
    signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase not configured')),
    createUserWithEmailAndPassword: () => Promise.reject(new Error('Firebase not configured')),
    signInWithRedirect: () => Promise.reject(new Error('Firebase not configured')),
    getRedirectResult: () => Promise.resolve(null),
    signOut: () => Promise.reject(new Error('Firebase not configured')),
  };
  
  // Create a dummy app object
  app = {} as FirebaseApp;
}

export { app, auth };
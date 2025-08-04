import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Only initialize Firebase Admin if we have the required environment variables
// This prevents initialization during build time when env vars aren't available
let app: any = null;

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing required Firebase Admin environment variables');
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

// Lazy initialization - only initialize when actually needed
export function getFirebaseApp() {
  if (!app) {
    app = initializeFirebaseAdmin();
  }
  return app;
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}

export function getAdminAuth() {
  return getAuth(getFirebaseApp());
}

// Legacy exports for backward compatibility
export const db = new Proxy({} as any, {
  get(target, prop) {
    return getDb()[prop as keyof ReturnType<typeof getDb>];
  }
});

export const adminAuth = new Proxy({} as any, {
  get(target, prop) {
    return getAdminAuth()[prop as keyof ReturnType<typeof getAdminAuth>];
  }
});
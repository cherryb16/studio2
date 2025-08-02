'use client';

import { createContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { doc, setDoc, getFirestore, getDoc } from 'firebase/firestore';
import { UserData } from '@/lib/types';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<any>;
  googleSignIn: () => Promise<any>;
  signUp: (userData: Omit<UserData, 'uid' | 'createdAt' | 'email' | 'snaptradeUserID' | 'snaptradeUserSecret'> & { email: string, password: string }) => Promise<any>;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const db = getFirestore();

async function saveUserData(user: User, userData: Omit<UserData, 'uid' | 'createdAt' | 'email' | 'snaptradeUserID' | 'snaptradeUserSecret'>) {
  const userRef = doc(db, 'users', user.uid);
  const dataToSave: UserData = {
    uid: user.uid,
    email: user.email,
    createdAt: Date.now(),
    firstName: userData.firstName,
    lastName: userData.lastName,
    dob: userData.dob,
    tradingExperience: userData.tradingExperience,
  };
  await setDoc(userRef, dataToSave, { merge: true });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const signIn = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const googleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const [firstName = '', ...lastNameParts] = result.user.displayName?.split(' ') ?? [];
        await saveUserData(result.user, {
          firstName,
          lastName: lastNameParts.join(' '),
          dob: 0,
          tradingExperience: '',
        });
      }
      console.log("Google user signed in with popup:", result.user.email);
    }
    return result;
  };

  const signUp = async (userData: Omit<UserData, 'uid' | 'createdAt' | 'email' | 'snaptradeUserID' | 'snaptradeUserSecret'> & { email: string, password: string }) => {
    const { email, password, ...additionalData } = userData;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: `${additionalData.firstName} ${additionalData.lastName}`,
      });
    }
    await saveUserData(userCredential.user, additionalData);
    return userCredential;
  };

  const logOut = () => {
    return signOut(auth);
  };

  useEffect(() => {
    console.log('AuthProvider: Setting up auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed. Current user:", currentUser?.email || "No user");
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Remove dependencies to avoid re-creating the listener

  // Separate useEffect for handling redirects
  useEffect(() => {
    // Only handle redirects after auth state is determined and we have pathname
    if (loading || !pathname) {
      console.log('AuthProvider: Skipping redirect - loading:', loading, 'pathname:', pathname);
      return;
    }

    console.log('AuthProvider: Handling redirect - user:', !!user, 'pathname:', pathname);

    if (user) {
      console.log("User is authenticated. Current path:", pathname);
      const isOnAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/';
      if (isOnAuthPage) {
        console.log(`User on auth page (${pathname}), redirecting to /dashboard`);
        router.push('/dashboard');
      }
    } else {
      console.log("User is NOT authenticated. Current path:", pathname);
      const isOnProtectedPage = pathname.startsWith('/dashboard') ||
                              pathname.startsWith('/trades') ||
                              pathname.startsWith('/journal') ||
                              pathname.startsWith('/positions');
      if (isOnProtectedPage) {
        console.log(`User on protected page (${pathname}), redirecting to /login`);
        router.push('/login');
      }
    }
  }, [user, loading, pathname, router]); // This effect runs when auth state or pathname changes

  const contextValue: AuthContextType = {
    user,
    loading,
    signIn,
    googleSignIn,
    signUp,
    logOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
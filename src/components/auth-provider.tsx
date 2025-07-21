'use client';

import { createContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<any>;
  googleSignIn: () => Promise<any>;
  signUp: (email: string, pass: string) => Promise<any>;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const signIn = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const googleSignIn = () => {
    const provider = new GoogleAuthProvider();
    return signInWithRedirect(auth, provider);
  };

  const signUp = (email: string, pass: string) => {
    return createUserWithEmailAndPassword(auth, email, pass);
  };

  const logOut = () => {
    return signOut(auth);
  };

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // Handle the redirect result when the user comes back from Google
        await getRedirectResult(auth);
      } catch (error) {
        console.error("Error handling Google sign-in redirect result:", error);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Handle redirects based on authentication state
      if (currentUser) {
        // User is signed in - redirect to dashboard if they're on auth pages
        const isOnAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/';
        if (isOnAuthPage) {
          router.push('/dashboard');
        }
      } else {
        // User is not signed in - redirect to login if they're on protected pages
        const isOnProtectedPage = pathname.startsWith('/dashboard') || 
                                 pathname.startsWith('/trades') || 
                                 pathname.startsWith('/journal');
        if (isOnProtectedPage) {
          router.push('/login');
        }
        
        // Check for Google redirect result only if user is not signed in
        await handleRedirectResult();
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const value = {
    user,
    loading,
    signIn,
    googleSignIn,
    signUp,
    logOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
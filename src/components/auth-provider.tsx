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
        console.log("Checking for redirect result...");
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Redirect result found:", result.user?.email);
          // The onAuthStateChanged will handle the redirect to dashboard
        } else {
          console.log("No redirect result found");
        }
      } catch (error) {
        console.error("Error handling Google sign-in redirect result:", error);
      }
    };

    // Check for redirect result immediately when component mounts
    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser?.email || "No user");
      setUser(currentUser);
      setLoading(false);

      // Handle redirects based on authentication state
      if (currentUser) {
        console.log("User authenticated, current path:", pathname);
        // User is signed in - redirect to dashboard if they're on auth pages
        const isOnAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/';
        if (isOnAuthPage) {
          console.log("Redirecting to dashboard...");
          router.push('/dashboard');
        }
      } else {
        console.log("No user, current path:", pathname);
        // User is not signed in - redirect to login if they're on protected pages
        const isOnProtectedPage = pathname.startsWith('/dashboard') || 
                                pathname.startsWith('/trades') || 
                                pathname.startsWith('/journal');
        if (isOnProtectedPage) {
          console.log("Redirecting to login...");
          router.push('/login');
        }
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
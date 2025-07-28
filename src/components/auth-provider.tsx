'use client';

import { createContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup, // Use signInWithPopup
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
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
    email: user.email, // Use user.email which can be string | null
    createdAt: Date.now(),
    firstName: userData.firstName,
    lastName: userData.lastName,
    dob: userData.dob,
    tradingExperience: userData.tradingExperience,
    // snaptradeUserID and snaptradeUserSecret will be added later
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
    const result = await signInWithPopup(auth, provider); // Use signInWithPopup
    // After successful sign-in with popup, check if user data exists and save if not
    if (result.user) {
      // Here you would typically check if the user data exists in your Firestore
      // If it doesn't, you would collect the additional information
      // For this example, I'll assume the signup form is used for initial data collection
      // If you want to handle this here, you might redirect to a profile completion page
      console.log("Google user signed in with popup:", result.user.email);
    }
    return result;
  };

  const signUp = async (userData: Omit<UserData, 'uid' | 'createdAt' | 'email' | 'snaptradeUserID' | 'snaptradeUserSecret'> & { email: string, password: string }) => {
    const { email, password, ...additionalData } = userData;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Optionally update user profile with first and last name
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed. Current user:", currentUser?.email || "No user");
      setUser(currentUser);
      setLoading(false);

      // Ensure pathname is not null before proceeding
      if (pathname === null) {
        console.log("Pathname is null, waiting for it to be available.");
        return; // Exit the effect until pathname is available
      }

      if (currentUser) {
        console.log("User is authenticated. Current path:", pathname);
        const isOnAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/';
        if (isOnAuthPage) {
          console.log(`User on auth page (${pathname}), redirecting to /dashboard`);
          router.push('/dashboard');
        } else {
          console.log(`User on protected page (${pathname}), no redirection needed.`);
        }
      } else {
        console.log("User is NOT authenticated. Current path:", pathname);
        const isOnProtectedPage = pathname.startsWith('/dashboard') ||
                                pathname.startsWith('/trades') ||
                                pathname.startsWith('/journal');
        if (isOnProtectedPage) {
          console.log(`User on protected page (${pathname}), redirecting to /login`);
          router.push('/login');
        } else {
          console.log(`User on public page (${pathname}), no redirection needed.`);
        }
      }
    });

    return () => unsubscribe();
  }, [router, pathname]); // Include pathname in the dependency array
}
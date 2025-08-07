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
import { UserData } from '@/lib/types';
import { OnboardingForm } from './onboarding-form';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<any>;
  googleSignIn: () => Promise<any>;
  signUp: (userData: Omit<UserData, 'uid' | 'createdAt' | 'email' | 'SnaptradeUserID' | 'snaptradeUserSecret'> & { email: string, password: string }) => Promise<any>;
  logOut: () => Promise<void>;
  showOnboarding: boolean;
  completeOnboarding: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use server-side API for all Firestore operations to avoid permission issues
async function saveUserDataViaAPI(user: User, userData: Omit<UserData, 'uid' | 'createdAt' | 'email' | 'SnaptradeUserID' | 'snaptradeUserSecret'>) {
  try {
    console.log("Attempting to save user data via API for:", user.uid);
    const dataToSave = {
      uid: user.uid,
      email: user.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      dob: userData.dob || 0, // Default to 0 if not provided
      tradingExperience: userData.tradingExperience,
    };
    
    console.log("Data to save:", dataToSave);
    
    const response = await fetch('/api/firebase/saveUserData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSave),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    console.log("User data saved successfully via API");
  } catch (error) {
    console.error("Error saving user data via API:", error);
    throw error;
  }
}

async function checkUserOnboardingViaAPI(uid: string) {
  try {
    console.log("Checking onboarding status via API for:", uid);
    const response = await fetch(`/api/firebase/getUserOnboardingStatus?uid=${uid}`);
    
    if (!response.ok) {
      console.log("API request failed, assuming new user");
      return { exists: false, onboardingCompleted: false };
    }
    
    const data = await response.json();
    console.log("Onboarding status:", data);
    return data;
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    // Assume new user if we can't check
    return { exists: false, onboardingCompleted: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const signIn = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const googleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        console.log("Google user signed in:", result.user.email, result.user.uid);
        
        // Check onboarding status via API
        const onboardingStatus = await checkUserOnboardingViaAPI(result.user.uid);
        
        if (!onboardingStatus.exists) {
          console.log("New Google user - creating profile and showing onboarding");
          const [firstName = '', ...lastNameParts] = result.user.displayName?.split(' ') ?? [];
          
          try {
            await saveUserDataViaAPI(result.user, {
              firstName,
              lastName: lastNameParts.join(' '),
              dob: 0,
              tradingExperience: '',
            });
            console.log("User data saved successfully");
          } catch (saveError) {
            console.error("Error saving user data:", saveError);
          }
          
          // Always show onboarding for new users
          setShowOnboarding(true);
        } else if (!onboardingStatus.onboardingCompleted) {
          console.log("Existing user needs onboarding");
          setShowOnboarding(true);
        } else {
          console.log("User has completed onboarding");
        }
      }
      return result;
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  };

  const signUp = async (userData: Omit<UserData, 'uid' | 'createdAt' | 'email' | 'SnaptradeUserID' | 'snaptradeUserSecret'> & { email: string, password: string }) => {
    try {
      const { email, password, ...additionalData } = userData;
      console.log("Creating new user account:", email);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        console.log("User account created:", userCredential.user.uid);
        
        try {
          await updateProfile(userCredential.user, {
            displayName: `${additionalData.firstName} ${additionalData.lastName}`,
          });
          console.log("User profile updated");
        } catch (profileError) {
          console.error("Error updating profile:", profileError);
        }
        
        try {
          await saveUserDataViaAPI(userCredential.user, additionalData);
          console.log("User data saved via API");
        } catch (saveError) {
          console.error("Error saving user data:", saveError);
        }
        
        // Always show onboarding for new email/password users
        console.log("Showing onboarding for new signup user");
        setShowOnboarding(true);
      }
      
      return userCredential;
    } catch (error) {
      console.error("Sign up error:", error);
      throw error;
    }
  };

  const logOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
    // Redirect to brokerage connection
    router.push('/settings?connect=true');
  };

  const skipOnboarding = () => {
    setShowOnboarding(false);
    // Go to dashboard without brokerage connection
    router.push('/dashboard');
  };

  useEffect(() => {
    console.log('AuthProvider: Setting up auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed. Current user:", currentUser?.email || "No user");
      setUser(currentUser);
      
      // Check if existing user needs onboarding via API (only for existing sessions)
      if (currentUser) {
        // Only check onboarding for users who are already signed in (not during signup/login flow)
        // This prevents double-checking during the signup/login process
        setTimeout(async () => {
          try {
            const onboardingStatus = await checkUserOnboardingViaAPI(currentUser.uid);
            console.log('User onboarding status:', onboardingStatus);
            
            if (!onboardingStatus.onboardingCompleted) {
              console.log('Showing onboarding for existing user');
              setShowOnboarding(true);
            }
          } catch (error) {
            console.error('Error checking onboarding status:', error);
          }
        }, 1000); // Small delay to avoid conflicts with signup/login flows
      }
      
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
    showOnboarding,
    completeOnboarding,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {showOnboarding && <OnboardingForm onComplete={completeOnboarding} onSkip={skipOnboarding} />}
    </AuthContext.Provider>
  );
}
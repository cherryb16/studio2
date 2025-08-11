import { db } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/firestore-schema';

export async function POST(request: Request) {
  try {
    const { userId, profile } = await request.json();

    if (!userId || !profile) {
      return new Response(
        JSON.stringify({ error: 'userId and profile are required' }),
        { status: 400 }
      );
    }

    console.log(`Saving onboarding profile for user: ${userId}`);

    // Save onboarding profile to subcollection using Admin SDK
    const onboardingRef = db.collection('snaptrade_users')
      .doc(userId)
      .collection('onboarding_information')
      .doc(userId);

    const profileData = {
      ...profile,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await onboardingRef.set(profileData);
    console.log('Onboarding profile saved to onboarding_information subcollection');

    // Also update the main snaptrade_users document with tradingExperience
    // Ensure the main document exists first
    const userDocRef = db.collection('snaptrade_users').doc(userId);
    const userDoc = await userDocRef.get();
    
    const mainDocData: any = {
      tradingExperience: profile.score?.skillLevel,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString(),
      updatedAt: new Date()
    };

    if (!userDoc.exists) {
      // Create the document with basic info if it doesn't exist
      mainDocData.uid = userId;
      mainDocData.createdAt = new Date();
      console.log('Creating new main user document');
    } else {
      console.log('Updating existing main user document');
    }

    await userDocRef.set(mainDocData, { merge: true });
    console.log('Main user document updated with onboarding completion status');

    return new Response(
      JSON.stringify({ success: true, message: 'Onboarding profile saved successfully' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving onboarding profile:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to save onboarding profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
}
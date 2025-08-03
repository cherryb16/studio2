import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { firebaseUserId, tradingExperience } = await request.json();

    if (!firebaseUserId || !tradingExperience) {
      return new Response(
        JSON.stringify({ error: 'firebaseUserId and tradingExperience are required' }),
        { status: 400 }
      );
    }

    console.log(`Updating trading experience for user: ${firebaseUserId}`);

    // Use set with merge to create the document if it doesn't exist
    const userRef = db.collection('snaptrade_users').doc(firebaseUserId);
    
    // First check if document exists
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      // Document exists, update it
      await userRef.update({
        tradingExperience,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      console.log('Updated existing user document');
    } else {
      // Document doesn't exist, create it with basic info
      console.log('User document does not exist, creating it');
      await userRef.set({
        uid: firebaseUserId,
        tradingExperience,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        createdAt: Date.now(),
      }, { merge: true });
      console.log('Created new user document');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating trading experience:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500 }
    );
  }
}
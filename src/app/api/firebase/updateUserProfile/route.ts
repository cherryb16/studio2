import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { firebaseUserId, ...profileData } = await request.json();

    if (!firebaseUserId) {
      return new Response(
        JSON.stringify({ error: 'firebaseUserId is required' }),
        { status: 400 }
      );
    }

    console.log(`Updating user profile for user: ${firebaseUserId}`);

    const userRef = db.collection('snaptrade_users').doc(firebaseUserId);
    
    // Check if document exists
    const userDoc = await userRef.get();
    
    const updateData = {
      ...profileData,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString(),
    };
    
    if (userDoc.exists) {
      // Document exists, update it
      await userRef.update(updateData);
      console.log('Updated existing user document');
    } else {
      // Document doesn't exist, create it with basic info
      console.log('User document does not exist, creating it');
      await userRef.set({
        uid: firebaseUserId,
        ...updateData,
        createdAt: Date.now(),
      }, { merge: true });
      console.log('Created new user document');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500 }
    );
  }
}
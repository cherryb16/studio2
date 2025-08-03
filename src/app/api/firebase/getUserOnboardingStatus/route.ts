import { db } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return new Response(
        JSON.stringify({ error: 'uid is required' }),
        { status: 400 }
      );
    }

    console.log(`Checking onboarding status for: ${uid}`);

    // Check if user document exists and get onboarding status
    const userRef = db.collection('snaptrade_users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      return new Response(
        JSON.stringify({
          exists: true,
          onboardingCompleted: userData?.onboardingCompleted || false,
        }),
        { status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({
          exists: false,
          onboardingCompleted: false,
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500 }
    );
  }
}
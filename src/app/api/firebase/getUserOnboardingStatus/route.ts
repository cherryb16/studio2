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
      // Attempt to fetch the onboarding profile to extract the experience level
      let experienceLevel: string | null = null;
      try {
        // In the Firestore schema, the onboarding profile is stored in the onboarding_information subcollection
        const onboardingDocRef = userRef.collection('onboarding_information').doc(uid);
        const onboardingDoc = await onboardingDocRef.get();
        if (onboardingDoc.exists) {
          const profileData = onboardingDoc.data();
          const answers: any = profileData?.answers ?? {};
          // Experience level can be stored under the camelCase or snake_case key
          experienceLevel = answers.selfRatedSkill ?? answers.self_rated_skill ?? null;
        }
      } catch (e) {
        console.error('Error fetching onboarding profile:', e);
      }
      return new Response(
        JSON.stringify({
          exists: true,
          onboardingCompleted: userData?.onboardingCompleted || false,
          experienceLevel,
        }),
        { status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({
          exists: false,
          onboardingCompleted: false,
          experienceLevel: null,
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
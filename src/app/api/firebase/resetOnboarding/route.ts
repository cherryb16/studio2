import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400 }
      );
    }

    // Delete the onboarding profile document using Admin SDK
    const profileRef = db.collection('snaptrade_users').doc(userId).collection('onboarding_information').doc(userId);
    await profileRef.delete();

    // Update the main user document to mark onboarding as incomplete using Admin SDK
    const userDocRef = db.collection('snaptrade_users').doc(userId);
    await userDocRef.update({
      onboardingCompleted: false,
      tradingExperience: null,
      updatedAt: new Date()
    });

    console.log(`Reset onboarding status for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Onboarding status reset successfully' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resetting onboarding status:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to reset onboarding status' }),
      { status: 500 }
    );
  }
}
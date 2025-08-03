import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const userData = await request.json();
    const { uid } = userData;

    if (!uid) {
      return new Response(
        JSON.stringify({ error: 'uid is required' }),
        { status: 400 }
      );
    }

    console.log(`Saving user data for: ${uid}`);

    // Save user data to snaptrade_users collection
    const userRef = db.collection('snaptrade_users').doc(uid);
    const dataToSave = {
      ...userData,
      createdAt: Date.now(),
    };

    await userRef.set(dataToSave, { merge: true });
    console.log('User data saved successfully via server-side');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving user data:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500 }
    );
  }
}
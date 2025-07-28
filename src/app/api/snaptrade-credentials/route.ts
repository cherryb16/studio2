import { db } from '@/lib/firebase-admin';

export async function getSnapTradeCredentials(firebaseUserId: string) {
  try {
    const userDoc = await db.collection('snaptrade_users').doc(firebaseUserId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const snaptradeUserId = data?.snaptradeUserID;
      const userSecret = data?.snaptradeUserSecret;
      if (snaptradeUserId && userSecret) {
        return { snaptradeUserId, userSecret };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// This is the required HTTP handler for Next.js API routes
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const firebaseUserId = searchParams.get('firebaseUserId');

  if (!firebaseUserId) {
    return new Response(JSON.stringify({ error: 'firebaseUserId is required' }), { status: 400 });
  }

  try {
    const credentials = await getSnapTradeCredentials(firebaseUserId);

    if (credentials) {
      return new Response(JSON.stringify(credentials), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: 'SnapTrade credentials not found for this user' }), { status: 404 });
    }
  } catch (error) {
    console.error('Error fetching SnapTrade credentials:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
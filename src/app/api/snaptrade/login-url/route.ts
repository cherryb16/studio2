import { db } from '@/lib/firebase-admin';
import { getWorkerLoginUrl } from '@/app/actions/snaptrade-worker';

export async function POST(request: Request) {
  try {
    const { firebaseUserId } = await request.json();

    if (!firebaseUserId) {
      return new Response(JSON.stringify({ error: 'firebaseUserId is required' }), { status: 400 });
    }

    const userDoc = await db.collection('snaptrade_users').doc(firebaseUserId).get();
    if (!userDoc.exists) {
      return new Response(JSON.stringify({ error: 'SnapTrade credentials not found for this user' }), { status: 404 });
    }

    const data = userDoc.data();
    const snaptradeUserId = data?.snaptradeUserID;
    const userSecret = data?.snaptradeUserSecret;

    if (!snaptradeUserId || !userSecret) {
      return new Response(JSON.stringify({ error: 'SnapTrade credentials not found for this user' }), { status: 404 });
    }

    const result = await getWorkerLoginUrl(snaptradeUserId, userSecret);
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error('Error generating SnapTrade login URL:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

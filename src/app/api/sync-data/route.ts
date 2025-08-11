import { SnapTradeFirestoreSync } from '@/lib/snaptrade-firestore-sync';
import { getSnapTradeCredentials } from '@/app/actions/data-sources/snaptrade/accounts';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400 }
      );
    }

    console.log(`Manual sync triggered for user: ${userId}`);

    // Get credentials
    const credentials = await getSnapTradeCredentials(userId);
    if (!credentials) {
      return new Response(
        JSON.stringify({ error: 'SnapTrade credentials not found' }),
        { status: 404 }
      );
    }

    const snapTradeCredentials = {
      userId: userId,
      snaptradeUserId: credentials.snaptradeUserId,
      userSecret: credentials.userSecret
    };

    // Run full sync
    const syncResult = await SnapTradeFirestoreSync.fullSync(snapTradeCredentials);

    if (syncResult.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Sync completed: ${syncResult.positions} positions, ${syncResult.trades} trades`
        }),
        { status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({ error: syncResult.error }),
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in manual sync:', error);
    return new Response(
      JSON.stringify({ error: 'Sync failed' }),
      { status: 500 }
    );
  }
}
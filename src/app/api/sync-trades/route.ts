import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getAllSnapTradeCredentials, getSnapTradeCredentials } from '@/app/actions/data-sources/snaptrade/accounts';
import { syncUserTrades } from '@/app/actions/data-sync/trades-sync';

export async function POST(request: Request) {
  try {
    // Verify the request is from Vercel Cron
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (process.env.VERCEL_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get all users with SnapTrade credentials
    const users = await getAllSnapTradeCredentials();
    const results = [];

    // Sync trades for each user
    for (const user of users) {
      try {
        const result = await syncUserTrades(
          user.firebaseUserId,
          user.snaptradeUserId,
          user.userSecret,
          false // Incremental sync
        );
        results.push({
          userId: user.firebaseUserId,
          ...result
        });
      } catch (error: any) {
        console.error(`Error syncing trades for user ${user.firebaseUserId}:`, error);
        results.push({
          userId: user.firebaseUserId,
          error: error.message
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Error in sync-trades API route:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Manual sync endpoint for individual users
export async function PUT(request: Request) {
  try {
    const { userId } = await request.json();
    
    // Get user's credentials
    const credentials = await getSnapTradeCredentials(userId);
    if (!credentials) {
      return NextResponse.json(
        { success: false, error: 'No SnapTrade credentials found' },
        { status: 404 }
      );
    }

    // Perform full sync for user
    const result = await syncUserTrades(
      userId,
      credentials.snaptradeUserId,
      credentials.userSecret,
      true // Full sync
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error in manual sync API route:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

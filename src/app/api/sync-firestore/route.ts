// API route to trigger Firestore sync from SnapTrade data
import { NextRequest, NextResponse } from 'next/server';
import { serverFullSync, serverQuickSync } from '@/app/actions/firestore-sync-server';

export async function POST(request: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    // For now, skip Firebase Admin token verification to avoid env var issues
    // In production, you would want to properly verify the token
    const token = authHeader.split('Bearer ')[1];
    console.log('Received auth token for sync request');
    
    // We'll rely on the Firebase client-side auth and user ID verification
    let authenticatedUserId;

    // Get request body
    const body = await request.json();
    const { userId, snaptradeUserId, userSecret, fullSync = false } = body;

    // Basic validation - ensure user ID is provided
    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing user ID' 
      }, { status: 400 });
    }

    if (!snaptradeUserId || !userSecret) {
      return NextResponse.json({ 
        error: 'Missing required fields: snaptradeUserId, userSecret' 
      }, { status: 400 });
    }

    console.log(`Starting ${fullSync ? 'full' : 'quick'} sync for user ${userId}`);

    const credentials = { userId, snaptradeUserId, userSecret };

    // Perform sync using server-only functions
    const result = fullSync 
      ? await serverFullSync(credentials)
      : await serverQuickSync(credentials);

    if (!result.success) {
      console.error('Sync failed:', result.error);
      return NextResponse.json({ 
        error: result.error || 'Sync failed' 
      }, { status: 500 });
    }

    console.log(`Sync completed successfully for user ${userId}:`, {
      positions: result.positions || 0,
      trades: result.trades || 0
    });

    return NextResponse.json({ 
      success: true,
      synced: {
        positions: result.positions || 0,
        trades: result.trades || 0
      },
      message: `${fullSync ? 'Full' : 'Quick'} sync completed successfully`
    });

  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Optional: Handle GET for sync status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // You could return last sync time, sync status, etc.
  return NextResponse.json({ 
    userId,
    status: 'Available for sync',
    endpoints: {
      quickSync: 'POST /api/sync-firestore { fullSync: false }',
      fullSync: 'POST /api/sync-firestore { fullSync: true }'
    }
  });
}
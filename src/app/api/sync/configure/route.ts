import { NextRequest, NextResponse } from 'next/server';
import { configureSyncForUser } from '@/app/actions/sync/daily-refresh';

export async function POST(request: NextRequest) {
  try {
    const { userId, snaptradeUserId, userSecret, enabled = true } = await request.json();
    
    if (!userId || !snaptradeUserId || !userSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, snaptradeUserId, userSecret' },
        { status: 400 }
      );
    }
    
    
    const result = await configureSyncForUser(userId, snaptradeUserId, userSecret, enabled);
    
    return NextResponse.json({
      success: true,
      message: `Sync ${enabled ? 'enabled' : 'disabled'} successfully`,
      ...result
    });
    
  } catch (error) {
    console.error('Error configuring sync:', error);
    return NextResponse.json(
      { 
        error: 'Failed to configure sync',
        message: error.message
      },
      { status: 500 }
    );
  }
}
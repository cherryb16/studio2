import { NextRequest, NextResponse } from 'next/server';
import { refreshUserData } from '@/app/actions/sync/daily-refresh';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    
    const result = await refreshUserData(userId);
    
    return NextResponse.json({
      success: true,
      message: 'Data refreshed successfully',
      ...result
    });
    
  } catch (error) {
    console.error('Error in manual refresh:', error);
    return NextResponse.json(
      { 
        error: 'Refresh failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { performDailyRefresh } from '@/app/actions/sync/daily-refresh';

// This endpoint will be called by a cron job at midnight
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from an authorized source (cron job)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    
    const result = await performDailyRefresh();
    
    
    return NextResponse.json({
      success: true,
      message: 'Daily refresh completed successfully',
      ...result
    });
    
  } catch (error) {
    console.error('Error in daily refresh cron job:', error);
    
    return NextResponse.json(
      { 
        error: 'Daily refresh failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'daily-refresh-cron',
    timestamp: new Date().toISOString()
  });
}
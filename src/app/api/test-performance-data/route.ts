// Test API endpoint for performance data
import { NextResponse } from 'next/server';
import { getPerformanceMetrics } from '@/app/actions/data-sources/snaptrade/analytics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const userSecret = searchParams.get('userSecret');

  if (!userId || !userSecret) {
    return NextResponse.json({
      success: false,
      error: 'Missing userId or userSecret parameters'
    }, { status: 400 });
  }

  try {
    console.log('Testing performance data calculation...');
    
    const result = await getPerformanceMetrics(userId, userSecret);
    
    console.log('Performance data result:', result);
    
    return NextResponse.json({
      success: true,
      data: result,
      summary: {
        hasVolatility: !!result.volatility,
        hasSharpeRatio: !!result.sharpeRatio,
        hasHistoricalData: !!result.historicalData?.length,
        totalReturnPercentage: result.totalReturnPercentage,
        positionCount: result.positionCount
      }
    });
  } catch (error) {
    console.error('Performance data test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
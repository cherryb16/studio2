import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioData } from '@/app/actions/refactored/portfolio-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const accountId = searchParams.get('accountId') || undefined;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const portfolioData = await getPortfolioData(userId, accountId);
    
    if ('error' in portfolioData) {
      return NextResponse.json(portfolioData, { status: 500 });
    }
    
    // Set cache headers for fast loading
    const headers = new Headers();
    if (portfolioData.cached) {
      // Cache for 1 hour if from cache
      headers.set('Cache-Control', 'public, max-age=3600');
    } else {
      // Cache for 5 minutes if from BigQuery
      headers.set('Cache-Control', 'public, max-age=300');
    }
    
    return NextResponse.json(portfolioData, { headers });
    
  } catch (error) {
    console.error('Error in portfolio dashboard API:', error);
    return NextResponse.json(
      { error: 'Failed to get portfolio data' },
      { status: 500 }
    );
  }
}
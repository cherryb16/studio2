import { snaptrade } from '@/app/actions/snaptrade-client';

export async function GET() {
  try {
    console.log('Testing SnapTrade API connection...');
    console.log('Client ID:', process.env.SNAPTRADE_CLIENT_ID ? 'SET' : 'MISSING');
    console.log('Secret:', process.env.SNAPTRADE_SECRET ? 'SET' : 'MISSING');
    
    // Simple API test - just list users
    const response = await snaptrade.authentication.listSnapTradeUsers();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SnapTrade API connection successful',
        userCount: response.data.length 
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('SnapTrade API test failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      }),
      { status: 500 }
    );
  }
}
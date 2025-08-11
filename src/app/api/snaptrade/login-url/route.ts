import { getSnapTradeLoginUrl } from '@/app/actions/snaptrade';

export async function POST(request: Request) {
  try {
    const { firebaseUserId, redirectUrl } = await request.json();

    if (!firebaseUserId) {
      return new Response(JSON.stringify({ error: 'firebaseUserId is required' }), { status: 400 });
    }

    // Use the existing snaptrade.ts function that handles credential creation automatically
    const result = await getSnapTradeLoginUrl(firebaseUserId, redirectUrl);
    
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: 400 });
    }
    
    // The function returns { data: { redirectUrl } }, but we need { redirectURI }
    if (result.data?.redirectUrl) {
      return new Response(JSON.stringify({ redirectURI: result.data.redirectUrl }), { status: 200 });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to generate login URL' }), { status: 500 });
  } catch (error) {
    console.error('Error generating SnapTrade login URL:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

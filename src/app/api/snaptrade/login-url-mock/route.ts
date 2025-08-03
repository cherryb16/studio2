// Temporary mock endpoint for when SnapTrade API is not accessible
export async function POST(request: Request) {
  try {
    const { firebaseUserId } = await request.json();

    if (!firebaseUserId) {
      return new Response(JSON.stringify({ error: 'firebaseUserId is required' }), { status: 400 });
    }

    console.log('Mock SnapTrade login URL for user:', firebaseUserId);

    // Return a mock redirect URL for testing
    return new Response(JSON.stringify({ 
      redirectURI: 'https://httpbin.org/get?mock=snaptrade&userId=' + firebaseUserId,
      mock: true,
      message: 'This is a mock response for testing when SnapTrade API is unavailable'
    }), { status: 200 });

  } catch (error) {
    console.error('Mock API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
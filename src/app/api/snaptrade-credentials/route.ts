// src/app/api/snaptrade-credentials/route.ts
import { getSnapTradeCredentials } from '@/app/actions/snaptrade';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const firebaseUserId = searchParams.get('firebaseUserId');

  if (!firebaseUserId) {
    return NextResponse.json({ error: 'firebaseUserId is required' }, { status: 400 });
  }

  try {
    const credentials = await getSnapTradeCredentials(firebaseUserId);

    if (credentials) {
      return NextResponse.json(credentials);
    }
    else {
      return NextResponse.json({ error: 'SnapTrade credentials not found for this user' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error fetching SnapTrade credentials:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
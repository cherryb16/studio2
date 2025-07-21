'use server';
import { suggestJournalPrompts } from '@/ai/flows/suggest-journal-prompts';
import type { Trade } from '@/lib/types';

export async function getSnapTradeLoginUrl(userId: string) {
  const snaptradeAPI = 'https://api.snaptrade.com/api/v1';
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const secret = process.env.SNAPTRADE_SECRET;

  if (!clientId || !secret) {
    console.error('SnapTrade credentials are not set.');
    return { error: 'Server configuration error.' };
  }

  try {
    // 1. Register User
    await fetch(`${snaptradeAPI}/auth/registerUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        secret: secret,
        userId: userId,
      }),
    });

    // 2. Get Login Link
    const response = await fetch(`${snaptradeAPI}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        secret: secret,
        userId: userId,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      return { url: data.redirectURI };
    } else {
      return { error: data.message || 'Failed to get login link.' };
    }
  } catch (error) {
    console.error('SnapTrade integration error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getJournalPrompts(trade: Trade) {
    const tradeDetails = `Instrument: ${trade.instrument}, Position: ${trade.position}, P/L: ${trade.pnl.toFixed(2)}, Entry: ${trade.entryPrice}, Exit: ${trade.exitPrice}, Date: ${trade.date}`;
    try {
        const result = await suggestJournalPrompts({ tradeDetails });
        return { prompts: result.suggestedPrompts };
    } catch (error) {
        console.error('AI suggestion error:', error);
        return { error: 'Failed to get AI suggestions.' };
    }
}

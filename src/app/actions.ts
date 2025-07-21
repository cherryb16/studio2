'use server';
import { suggestJournalPrompts } from '@/ai/flows/suggest-journal-prompts';
import type { Trade } from '@/lib/types';

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

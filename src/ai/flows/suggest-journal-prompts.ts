// src/ai/flows/suggest-journal-prompts.ts
'use server';

/**
 * @fileOverview AI-powered flow that acts as a trading assistant that analyzes the provided trade data and suggests prompts for journal entries.
 *
 * - suggestJournalPrompts - A function that suggests prompts based on trade details.
 * - SuggestJournalPromptsInput - The input type for the suggestJournalPrompts function.
 * - SuggestJournalPromptsOutput - The return type for the suggestJournalPrompts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestJournalPromptsInputSchema = z.object({
  tradeDetails: z.string().describe('Details of the trade including entry price, exit price, date, and instrument.'),
});
export type SuggestJournalPromptsInput = z.infer<typeof SuggestJournalPromptsInputSchema>;

const SuggestJournalPromptsOutputSchema = z.object({
  suggestedPrompts: z.array(z.string()).describe('An array of suggested prompts for the user to consider when writing their journal entry.'),
});
export type SuggestJournalPromptsOutput = z.infer<typeof SuggestJournalPromptsOutputSchema>;

export async function suggestJournalPrompts(input: SuggestJournalPromptsInput): Promise<SuggestJournalPromptsOutput> {
  return suggestJournalPromptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestJournalPromptsPrompt',
  input: {schema: SuggestJournalPromptsInputSchema},
  output: {schema: SuggestJournalPromptsOutputSchema},
  prompt: `You are a trading journal assistant. Given the following trade details, suggest 3-5 prompts that the user should consider when writing their journal entry.

Trade Details:
{{tradeDetails}}

Prompts:`, // No Handlebars logic, it's just for displaying pre-processed data
});

const suggestJournalPromptsFlow = ai.defineFlow(
  {
    name: 'suggestJournalPromptsFlow',
    inputSchema: SuggestJournalPromptsInputSchema,
    outputSchema: SuggestJournalPromptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

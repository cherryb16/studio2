'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { JournalEntry, Trade } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getJournalPrompts } from '@/app/actions';
import { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  notes: z.string().min(1, 'Notes are required'),
  tradeId: z.string().optional(),
});

type JournalFormProps = {
  entry: JournalEntry | null;
  onSave: (entry: JournalEntry) => void;
  trades: Trade[];
};

export function JournalForm({ entry, onSave, trades }: JournalFormProps) {
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: entry?.title || '',
      notes: entry?.notes || '',
      tradeId: entry?.tradeId,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onSave({
      ...values,
      id: entry?.id || Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
    });
  };

  const handleTradeSelect = async (tradeId: string) => {
    const selectedTrade = trades.find(t => t.id === tradeId);
    if (!selectedTrade) return;

    setLoadingPrompts(true);
    setPrompts([]);
    try {
        const result = await getJournalPrompts(selectedTrade);
        if (result.prompts) {
            setPrompts(result.prompts);
        } else if (result.error) {
            toast({ variant: 'destructive', title: 'AI Assistant Error', description: result.error });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'AI Assistant Error', description: 'Could not fetch suggestions.' });
    } finally {
        setLoadingPrompts(false);
    }
  };

  const addPromptToNotes = (prompt: string) => {
    const currentNotes = form.getValues('notes');
    form.setValue('notes', currentNotes ? `${currentNotes}\n\n${prompt}` : prompt);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Analysis of NVDA trade" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tradeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link to Trade (Optional)</FormLabel>
              <Select onValueChange={(value) => {
                  field.onChange(value);
                  handleTradeSelect(value);
              }} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a trade to link" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {trades.map(trade => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.instrument} - {trade.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {(loadingPrompts || prompts.length > 0) && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-semibold flex items-center"><Wand2 className="w-4 h-4 mr-2 text-accent"/> AI Suggestions</h4>
                {loadingPrompts ? (
                    <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating ideas...
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {prompts.map((prompt, index) => (
                            <Button key={index} type="button" variant="outline" size="sm" onClick={() => addPromptToNotes(prompt)}>
                                {prompt}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={8} placeholder="What went well? What could be improved? ..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">Save Entry</Button>
      </form>
    </Form>
  );
}

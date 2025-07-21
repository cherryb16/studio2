'use client';
import type { JournalEntry, Trade } from '@/lib/types';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JournalForm } from './journal-form';
import { Badge } from '../ui/badge';

const initialTrades: Trade[] = [
    { id: '1', instrument: 'AAPL', date: '2023-10-26', entryPrice: 170.50, exitPrice: 175.20, position: 'long', pnl: 470, status: 'win' },
    { id: '2', instrument: 'TSLA', date: '2023-10-25', entryPrice: 220.10, exitPrice: 215.80, position: 'short', pnl: 430, status: 'win' },
    { id: '3', instrument: 'GOOGL', date: '2023-10-24', entryPrice: 135.00, exitPrice: 133.50, position: 'long', pnl: -150, status: 'loss' },
    { id: '4', instrument: 'MSFT', date: '2023-10-23', entryPrice: 330.00, exitPrice: 330.00, position: 'long', pnl: 0, status: 'breakeven' },
    { id: '5', instrument: 'NVDA', date: '2023-10-20', entryPrice: 430.80, exitPrice: 455.10, position: 'long', pnl: 2430, status: 'win' },
];


const initialEntries: JournalEntry[] = [
    { id: '1', date: '2023-10-26', title: 'Great AAPL Long', notes: 'Followed my plan perfectly. Waited for the breakout confirmation and managed the trade well.', tradeId: '1' },
    { id: '2', date: '2023-10-24', title: 'GOOGL Loss - FOMO', notes: 'Jumped in too early without confirmation, chasing the price. Need to be more patient.', tradeId: '3' },
    { id: '3', date: '2023-10-20', title: 'NVDA breakout', notes: 'Excellent execution. The stock showed strong relative strength and I caught a good portion of the move.', tradeId: '5' },
];

export function JournalList() {
    const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

    const handleSave = (entry: JournalEntry) => {
        if (editingEntry) {
            setEntries(entries.map(e => (e.id === entry.id ? entry : e)));
        } else {
            setEntries([...entries, { ...entry, id: (entries.length + 1).toString() }]);
        }
        setIsDialogOpen(false);
        setEditingEntry(null);
    };

    const handleDelete = (id: string) => {
        setEntries(entries.filter(e => e.id !== id));
    };

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntry(entry);
        setIsDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingEntry(null);
        setIsDialogOpen(true);
    };

    const getTradeForEntry = (tradeId?: string) => {
        if (!tradeId) return null;
        return initialTrades.find(t => t.id === tradeId);
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <div className="space-y-4">
                <div className="flex justify-end">
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" /> New Entry
                    </Button>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {entries.map(entry => {
                        const trade = getTradeForEntry(entry.tradeId);
                        return (
                            <Card key={entry.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>{entry.title}</CardTitle>
                                    <CardDescription>{new Date(entry.date).toLocaleDateString()}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <p className="text-sm text-muted-foreground line-clamp-4">{entry.notes}</p>
                                    {trade && (
                                        <div className="mt-4">
                                            <Badge>
                                                {trade.instrument} {trade.position === 'long' ? 'Long' : 'Short'} ({trade.status})
                                            </Badge>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            </div>
             <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-headline">{editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
                </DialogHeader>
                <JournalForm onSave={handleSave} entry={editingEntry} trades={initialTrades} />
            </DialogContent>
        </Dialog>
    )
}

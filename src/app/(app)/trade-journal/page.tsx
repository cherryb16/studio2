'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getEnhancedTrades, getTradeSummaryStats } from '@/app/actions/snaptrade-trades';
import { getJournalPrompts } from '@/app/actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Calendar,
  DollarSign,
  Activity,
  Target,
  Loader2,
  BookOpen,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import type { EnhancedTrade } from '@/app/actions/snaptrade-trades';
import type { Trade } from '@/lib/types';

interface JournalEntry {
  id: string;
  tradeId: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export default function TradesJournalPage() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [selectedTrade, setSelectedTrade] = useState<EnhancedTrade | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [journalNotes, setJournalNotes] = useState('');
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<string[]>([]);

  // Get SnapTrade credentials
  const { data: credentials } = useQuery({
    queryKey: ['snaptradeCredentials', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error('No user ID');
      const res = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      return res.json();
    },
    enabled: !!user?.uid,
  });

  // Fetch trades
  const { data: trades, isLoading: tradesLoading } = useQuery({
    queryKey: ['trades', credentials?.snaptradeUserId, credentials?.userSecret, selectedPeriod],
    queryFn: () => getEnhancedTrades(
      credentials!.snaptradeUserId,
      credentials!.userSecret,
      selectedPeriod === 'all' ? undefined : getStartDate(selectedPeriod)
    ),
    enabled: !!credentials?.snaptradeUserId && !!credentials?.userSecret,
  });

  // Fetch trade statistics
  const { data: stats } = useQuery({
    queryKey: ['tradeStats', credentials?.snaptradeUserId, credentials?.userSecret, selectedPeriod],
    queryFn: () => getTradeSummaryStats(
      credentials!.snaptradeUserId,
      credentials!.userSecret,
      selectedPeriod
    ),
    enabled: !!credentials?.snaptradeUserId && !!credentials?.userSecret,
  });

  // Fetch journal entries from localStorage (in production, use a database)
  const { data: journalEntries } = useQuery({
    queryKey: ['journalEntries'],
    queryFn: async () => {
      const stored = localStorage.getItem('journalEntries');
      return stored ? JSON.parse(stored) : [];
    },
  });

  const getStartDate = (period: 'day' | 'week' | 'month' | 'year'): Date => {
    const date = new Date();
    switch (period) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date;
  };

  const handleJournalOpen = async (trade: EnhancedTrade) => {
    setSelectedTrade(trade);
    setIsJournalOpen(true);
    
    // Load existing journal entry if it exists
    const existingEntry = journalEntries?.find((entry: JournalEntry) => entry.tradeId === trade.id);
    setJournalNotes(existingEntry?.notes || '');
    
    // Get AI prompts
    if (!existingEntry) {
      setLoadingPrompts(true);
      try {
        const tradeForPrompts: Trade = {
          id: trade.id,
          instrument: trade.symbol,
          date: format(trade.executedAt, 'yyyy-MM-dd'),
          entryPrice: trade.entryPrice || trade.price,
          exitPrice: trade.exitPrice || trade.price,
          position: trade.position === 'close' ? 'long' : trade.position,
          pnl: trade.realizedPnL || 0,
          status: trade.realizedPnL ? (trade.realizedPnL > 0 ? 'win' : trade.realizedPnL < 0 ? 'loss' : 'breakeven') : 'breakeven'
        };
        
        const result = await getJournalPrompts(tradeForPrompts);
        if (result.prompts) {
          setAiPrompts(result.prompts);
        }
      } catch (error) {
        console.error('Error getting AI prompts:', error);
      } finally {
        setLoadingPrompts(false);
      }
    }
  };

  const saveJournalEntry = () => {
    if (!selectedTrade || !journalNotes.trim()) return;
    
    const entries = JSON.parse(localStorage.getItem('journalEntries') || '[]');
    const existingIndex = entries.findIndex((e: JournalEntry) => e.tradeId === selectedTrade.id);
    
    const newEntry: JournalEntry = {
      id: existingIndex >= 0 ? entries[existingIndex].id : Date.now().toString(),
      tradeId: selectedTrade.id,
      notes: journalNotes,
      createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : new Date(),
      updatedAt: new Date(),
    };
    
    if (existingIndex >= 0) {
      entries[existingIndex] = newEntry;
    } else {
      entries.push(newEntry);
    }
    
    localStorage.setItem('journalEntries', JSON.stringify(entries));
    setIsJournalOpen(false);
    setJournalNotes('');
    setAiPrompts([]);
  };

  const addPromptToNotes = (prompt: string) => {
    setJournalNotes(prev => prev ? `${prev}\n\n${prompt}` : prompt);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (!user || !credentials) {
    return (
      <Card className="max-w-md mx-auto mt-32">
        <CardHeader>
          <CardTitle>Connect Your Brokerage</CardTitle>
          <CardDescription>
            Please connect your brokerage account to view trades and journal entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.href = '/settings'}>
            Connect Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  const tradesArray = Array.isArray(trades) ? trades : [];
  const hasError = trades && 'error' in trades;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trading Activity & Journal</h1>
        <p className="text-muted-foreground">
          Track your trades and document your trading insights
        </p>
      </div>

      {/* Summary Stats */}
      {stats && !('error' in stats) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.totalRealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.totalRealizedPnL)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.closedTrades} closed trades
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.winRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.winningTrades} wins / {stats.losingTrades} losses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.profitFactor.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Avg Win: {formatCurrency(stats.avgWin)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
              <p className="text-xs text-muted-foreground">
                Fees: {formatCurrency(stats.totalFees)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['day', 'week', 'month', 'year', 'all'] as const).map((period) => (
          <Button
            key={period}
            variant={selectedPeriod === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod(period)}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Button>
        ))}
      </div>

      {/* Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>
            Click on any trade to add or view journal notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tradesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : hasError ? (
            <p className="text-center text-muted-foreground py-8">
              Error loading trades. Please try again.
            </p>
          ) : tradesArray.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No trades found for the selected period.
            </p>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead>Journal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tradesArray.map((trade) => {
                    const hasJournal = journalEntries?.some(
                      (entry: JournalEntry) => entry.tradeId === trade.id
                    );
                    
                    return (
                      <TableRow 
                        key={trade.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleJournalOpen(trade)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {format(trade.executedAt, 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(trade.executedAt, 'HH:mm:ss')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{trade.symbol}</div>
                            {trade.isOption && (
                              <div className="text-xs text-muted-foreground">
                                {trade.optionDetails?.type} ${trade.optionDetails?.strike}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.isOption ? 'secondary' : 'default'}>
                            {trade.isOption ? 'Option' : 'Stock'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={trade.action === 'BUY' ? 'default' : 'destructive'}
                            className={trade.action === 'BUY' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {trade.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{trade.units}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(trade.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(trade.totalValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {trade.realizedPnL !== undefined ? (
                            <div className={trade.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(trade.realizedPnL)}
                              {trade.entryPrice && (
                                <div className="text-xs">
                                  {formatPercent(((trade.exitPrice! - trade.entryPrice) / trade.entryPrice) * 100)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasJournal ? (
                            <Badge variant="outline" className="gap-1">
                              <BookOpen className="h-3 w-3" />
                              Noted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              Add Note
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Journal Dialog */}
      <Dialog open={isJournalOpen} onOpenChange={setIsJournalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trade Journal Entry</DialogTitle>
          </DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              {/* Trade Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Symbol:</span>{' '}
                      <span className="font-medium">{selectedTrade.symbol}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>{' '}
                      <span className="font-medium">
                        {format(selectedTrade.executedAt, 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Action:</span>{' '}
                      <Badge variant={selectedTrade.action === 'BUY' ? 'default' : 'destructive'}>
                        {selectedTrade.action}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Quantity:</span>{' '}
                      <span className="font-medium">{selectedTrade.units}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price:</span>{' '}
                      <span className="font-medium">{formatCurrency(selectedTrade.price)}</span>
                    </div>
                    {selectedTrade.realizedPnL !== undefined && (
                      <div>
                        <span className="text-muted-foreground">P&L:</span>{' '}
                        <span className={`font-medium ${selectedTrade.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedTrade.realizedPnL)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI Prompts */}
              {loadingPrompts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Getting AI suggestions...
                </div>
              ) : aiPrompts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Reflection prompts:</p>
                  <div className="flex flex-wrap gap-2">
                    {aiPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => addPromptToNotes(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Journal Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Journal Notes</label>
                <Textarea
                  value={journalNotes}
                  onChange={(e) => setJournalNotes(e.target.value)}
                  placeholder="Document your thoughts, analysis, and lessons learned..."
                  rows={8}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsJournalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveJournalEntry} disabled={!journalNotes.trim()}>
                  Save Entry
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
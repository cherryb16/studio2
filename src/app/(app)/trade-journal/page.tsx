'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { 
  getEnhancedTrades, 
  getTradeSummaryStats,
  type EnhancedTrade 
} from '@/app/actions/snaptrade-trades';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  BarChart3,
  Timer,
  Zap,
  Award,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import type { Trade } from '@/lib/types';

interface JournalEntry {
  id: string;
  tradeId: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

interface GroupedTrade {
  id: string;
  symbol: string;
  instrument: string;
  isOption: boolean;
  optionDetails?: EnhancedTrade['optionDetails'];
  totalUnits: number;
  averageEntryPrice: number;
  averageExitPrice?: number;
  totalValue: number;
  totalFees: number;
  realizedPnL?: number;
  status: 'open' | 'closed' | 'partial';
  currency: string;
  executedAt: Date;
  holdingPeriod?: number;
  trades: EnhancedTrade[]; // Individual buy/sell trades
}

interface SnapTradeAccount {
  id: string;
  name?: string; // Optional, as you have fallback logic
  account_name?: string;
  nickname?: string;
  institution_name?: string;
  number?: string;
  // Add other properties if needed based on SnapTrade API docs
}

// Function to group related trades
function groupRelatedTrades(trades: EnhancedTrade[]): GroupedTrade[] {
  const groups = new Map<string, EnhancedTrade[]>();
  
  // Group trades by instrument identifier
  for (const trade of trades) {
    let groupKey: string;
    
    if (trade.isOption && trade.optionDetails) {
      // For options, group by symbol + strike + expiration + type
      groupKey = `${trade.symbol}_${trade.optionDetails.strike}_${trade.optionDetails.expiration}_${trade.optionDetails.type}`;
    } else {
      // For stocks, group by symbol
      groupKey = trade.symbol;
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(trade);
  }
  
  // Convert groups to GroupedTrade objects
  const groupedTrades: GroupedTrade[] = [];
  
  for (const [groupKey, groupTrades] of groups) {
    // Sort trades by date
    const sortedTrades = groupTrades.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
    
    // Calculate aggregate values
    const buyTrades = sortedTrades.filter(t => t.action === 'BUY');
    const sellTrades = sortedTrades.filter(t => t.action === 'SELL');
    
    const totalBuyUnits = buyTrades.reduce((sum, t) => sum + t.units, 0);
    const totalSellUnits = sellTrades.reduce((sum, t) => sum + t.units, 0);
    const totalBuyValue = buyTrades.reduce((sum, t) => sum + (t.units * t.price), 0);
    const totalSellValue = sellTrades.reduce((sum, t) => sum + (t.units * t.price), 0);
    
    const averageEntryPrice = totalBuyUnits > 0 ? totalBuyValue / totalBuyUnits : 0;
    const averageExitPrice = totalSellUnits > 0 ? totalSellValue / totalSellUnits : undefined;
    
    const totalFees = sortedTrades.reduce((sum, t) => sum + t.fee, 0);
    const totalUnits = totalBuyUnits - totalSellUnits;
    
    // Determine status
    let status: GroupedTrade['status'] = 'open';
    let realizedPnL: number | undefined;
    
    if (totalUnits === 0) {
      status = 'closed';
      // Calculate P&L for closed positions
      const multiplier = sortedTrades[0]?.isOption ? 100 : 1;
      if (averageExitPrice && averageEntryPrice) {
        realizedPnL = (averageExitPrice - averageEntryPrice) * totalSellUnits * multiplier - totalFees;
      }
    } else if (totalSellUnits > 0) {
      status = 'partial';
      // Calculate partial P&L
      const multiplier = sortedTrades[0]?.isOption ? 100 : 1;
      if (averageExitPrice && averageEntryPrice) {
        realizedPnL = (averageExitPrice - averageEntryPrice) * totalSellUnits * multiplier - totalFees;
      }
    }
    
    const firstTrade = sortedTrades[0];
    const lastTrade = sortedTrades[sortedTrades.length - 1];
    const holdingPeriod = status === 'closed' && buyTrades.length > 0 && sellTrades.length > 0
      ? Math.floor((lastTrade.executedAt.getTime() - firstTrade.executedAt.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;
    
    groupedTrades.push({
      id: groupKey,
      symbol: firstTrade.symbol,
      instrument: firstTrade.instrument,
      isOption: firstTrade.isOption,
      optionDetails: firstTrade.optionDetails,
      totalUnits: Math.abs(totalUnits),
      averageEntryPrice,
      averageExitPrice,
      totalValue: Math.abs(totalUnits * averageEntryPrice),
      totalFees,
      realizedPnL,
      status,
      currency: firstTrade.currency,
      executedAt: lastTrade.executedAt, // Use the most recent trade date
      holdingPeriod,
      trades: sortedTrades,
    });
  }
  
  // Sort grouped trades by most recent activity
  return groupedTrades.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
}

export default function EnhancedTradeJournalPage() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [selectedTrade, setSelectedTrade] = useState<EnhancedTrade | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [journalNotes, setJournalNotes] = useState('');
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<string[]>([]);
  
  // Filter states
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'stocks' | 'options'>('all');
  const [selectedPnL, setSelectedPnL] = useState<'all' | 'wins' | 'losses' | 'closed' | 'open'>('all');
  
  // Expanded trades state
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());
  
  // Expanded stats cards state
  const [expandedStatsCards, setExpandedStatsCards] = useState<Set<string>>(new Set());

  // Get SnapTrade credentials
  const { data: credentials } = useQuery({
    queryKey: ['snaptradeCredentials', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error('No user ID');
      const res = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      return res.json() as Promise<{ snaptradeUserId: string; userSecret: string }>;
    },
    enabled: !!user?.uid,
  });

  // Get user accounts
  const { data: accounts } = useQuery<SnapTradeAccount[]>({ // Explicitly type the data
    queryKey: ['snaptradeAccounts', credentials?.snaptradeUserId, credentials?.userSecret],
    queryFn: async () => {
      if (!credentials?.snaptradeUserId || !credentials?.userSecret) return [];
      try {
        const { snaptrade } = await import('@/app/actions/snaptrade-client');
        const response = await snaptrade.accountInformation.listUserAccounts({
          userId: credentials.snaptradeUserId,
          userSecret: credentials.userSecret,
        });
        console.log('Fetched accounts:', response.data);
      return response.data as SnapTradeAccount[] || []; // Ensure response.data is treated as SnapTradeAccount[]
      } catch (error) {
        console.error('Error fetching accounts:', error);
        return [];
      }
    },
    enabled: !!credentials?.snaptradeUserId && !!credentials?.userSecret,
  });

  // Fetch trade activities
  const { data: trades, isLoading: tradesLoading } = useQuery({
    queryKey: ['tradeActivities', credentials?.snaptradeUserId, credentials?.userSecret, selectedPeriod],
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
    
    // Get AI prompts for closed trades
    if (!existingEntry && trade.status === 'closed') {
      setLoadingPrompts(true);
      try {
        const tradeForPrompts: Trade = {
          id: trade.id,
          instrument: trade.instrument,
          date: format(trade.executedAt, 'yyyy-MM-dd'),
          entryPrice: trade.entryPrice || trade.price,
          exitPrice: trade.exitPrice || trade.price,
          position: 'long', // Simplified for now
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

  const toggleTradeExpansion = (tradeId: string) => {
    setExpandedTrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tradeId)) {
        newSet.delete(tradeId);
      } else {
        newSet.add(tradeId);
      }
      return newSet;
    });
  };

  const toggleStatsCardExpansion = (cardId: string) => {
    setExpandedStatsCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
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

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'bg-green-100 text-green-800 border-green-200';
      case 'SELL': return 'bg-red-100 text-red-800 border-red-200';
      case 'EXPIRE': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ASSIGN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EXERCISE': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

  // Debug logging
  if (accounts && accounts.length > 0) {
    console.log('Accounts structure:', accounts[0]);
    console.log('All accounts:', accounts);
  } else {
    console.log('No accounts found or accounts is empty:', accounts);
  }

  // Filter trades based on selected filters
  const filteredTrades = tradesArray.filter((trade) => {
    // Account filter
    if (selectedAccount !== 'all' && trade.accountId !== selectedAccount) {
      return false;
    }

    // Type filter
    if (selectedType === 'stocks' && trade.isOption) {
      return false;
    }
    if (selectedType === 'options' && !trade.isOption) {
      return false;
    }

    // P&L filter
    if (selectedPnL === 'wins' && (trade.realizedPnL === undefined || trade.realizedPnL <= 0)) {
      return false;
    }
    if (selectedPnL === 'losses' && (trade.realizedPnL === undefined || trade.realizedPnL >= 0)) {
      return false;
    }
    if (selectedPnL === 'closed' && trade.status !== 'closed') {
      return false;
    }
    if (selectedPnL === 'open' && trade.status !== 'open') {
      return false;
    }

    return true;
  });

  // Group related trades together
  const groupedTrades = groupRelatedTrades(filteredTrades);

  // Calculate filtered stats based on selected filters
  const filteredStats = React.useMemo(() => {
    // If stats is not available or has an error, return null or a default state
    if (!stats || 'error' in stats) return null;
    
    const closedFilteredTrades = filteredTrades.filter(t => t.status === 'closed');
    const winningFilteredTrades = filteredTrades.filter(t => t.realizedPnL && t.realizedPnL > 0);
    const losingFilteredTrades = filteredTrades.filter(t => t.realizedPnL && t.realizedPnL < 0);
    
    const totalRealizedPnL = filteredTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const totalFees = filteredTrades.reduce((sum, t) => sum + t.fee, 0);
    
    const winRate = closedFilteredTrades.length > 0 ? (winningFilteredTrades.length / closedFilteredTrades.length) * 100 : 0;
    
    let totalWins = 0;
    let totalLosses = 0;
    
    for (const trade of filteredTrades) {
      if (trade.realizedPnL && trade.realizedPnL > 0) {
        totalWins += trade.realizedPnL;
      } else if (trade.realizedPnL && trade.realizedPnL < 0) {
        totalLosses += Math.abs(trade.realizedPnL);
      }
    }
    
    const avgWin = winningFilteredTrades.length > 0 ? totalWins / winningFilteredTrades.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    
    // Detailed breakdowns for expandable cards
    const stockTrades = filteredTrades.filter(t => !t.isOption);
    const optionTrades = filteredTrades.filter(t => t.isOption);
    const avgLoss = losingFilteredTrades.length > 0 ? totalLosses / losingFilteredTrades.length : 0;
    
    // Find largest win and loss
    const largestWin = winningFilteredTrades.reduce<EnhancedTrade | null>((max, trade) => {
      return trade.realizedPnL !== undefined && (max === null || trade.realizedPnL > (max.realizedPnL ?? -Infinity)) ? trade : max;
    }, null);
    const largestLoss = losingFilteredTrades.reduce<EnhancedTrade | null>((min, trade) => {
      return trade.realizedPnL !== undefined && (min === null || trade.realizedPnL < (min.realizedPnL ?? Infinity)) ? trade : min;
    }, null);

    // Breakdown by account
    const accountBreakdown = filteredTrades.reduce((acc, trade) => {
      const accountName = accounts?.find(a => a.id === trade.accountId)?.name || `Account ${trade.accountId.slice(-4)}`;
      if (!acc[accountName]) {
        acc[accountName] = { trades: 0, pnl: 0, fees: 0 };
      }
      acc[accountName].trades++;
      acc[accountName].pnl += trade.realizedPnL || 0;
      acc[accountName].fees += trade.fee;
      return acc;
    }, {} as Record<string, { trades: number; pnl: number; fees: number }>);

    // Breakdown by symbol
    const symbolBreakdown = filteredTrades.reduce((acc, trade) => {
      if (!acc[trade.symbol]) {
        acc[trade.symbol] = { trades: 0, pnl: 0, fees: 0 };
      }
      acc[trade.symbol].trades++;
      acc[trade.symbol].pnl += trade.realizedPnL || 0;
      acc[trade.symbol].fees += trade.fee;
      return acc;
    }, {} as Record<string, { trades: number; pnl: number; fees: number }>);

    return {
      totalTrades: filteredTrades.length,
      closedTrades: closedFilteredTrades.length,
      winningTrades: winningFilteredTrades.length,
      losingTrades: losingFilteredTrades.length,
      totalRealizedPnL,
      totalFees,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      optionTrades: optionTrades.length,
      stockTrades: stockTrades.length,
      largestWin,
      largestLoss,
      accountBreakdown,
      symbolBreakdown: Object.entries(symbolBreakdown)
        .sort(([,a], [,b]) => b.trades - a.trades)
        .slice(0, 5) // Top 5 most traded symbols
        .reduce((acc, [symbol, data]) => ({ ...acc, [symbol]: data }), {})
    };
  }, [filteredTrades, stats, accounts]); // Added accounts dependency

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trading Activity & Journal</h1>
        <p className="text-muted-foreground">
          Track your trades, options activity, and document your insights
        </p>
      </div>

      {/* Enhanced Summary Stats */}
      {filteredStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => toggleStatsCardExpansion('pnl')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Total P&L
                {expandedStatsCards.has('pnl') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${filteredStats.totalRealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(filteredStats.totalRealizedPnL)}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredStats.closedTrades} closed trades
              </p>
              {expandedStatsCards.has('pnl') && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Largest Win:</span>
                      <span className="text-green-600">
                        {filteredStats.largestWin ? `${filteredStats.largestWin.symbol} ${formatCurrency(filteredStats.largestWin.realizedPnL || 0)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Largest Loss:</span>
                      <span className="text-red-600">
                        {filteredStats.largestLoss ? `${filteredStats.largestLoss.symbol} ${formatCurrency(filteredStats.largestLoss.realizedPnL || 0)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Fees:</span>
                      <span>{formatCurrency(filteredStats.totalFees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Net P&L:</span>
                      <span className={filteredStats.totalRealizedPnL - filteredStats.totalFees >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(filteredStats.totalRealizedPnL - filteredStats.totalFees)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => toggleStatsCardExpansion('winrate')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Win Rate
                {expandedStatsCards.has('winrate') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredStats.winRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredStats.winningTrades}W / {filteredStats.losingTrades}L
              </p>
              {expandedStatsCards.has('winrate') && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Total Trades:</span>
                      <span>{filteredStats.totalTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Closed Trades:</span>
                      <span>{filteredStats.closedTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Open Trades:</span>
                      <span>{filteredStats.totalTrades - filteredStats.closedTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Win %:</span>
                      <span className="text-green-600">{((filteredStats.winningTrades / filteredStats.totalTrades) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Loss %:</span>
                      <span className="text-red-600">{((filteredStats.losingTrades / filteredStats.totalTrades) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => toggleStatsCardExpansion('profitfactor')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Profit Factor
                {expandedStatsCards.has('profitfactor') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredStats.profitFactor.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Avg Win: {formatCurrency(filteredStats.avgWin)}
              </p>
              {expandedStatsCards.has('profitfactor') && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Avg Win:</span>
                      <span className="text-green-600">{formatCurrency(filteredStats.avgWin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Loss:</span>
                      <span className="text-red-600">{formatCurrency(filteredStats.avgLoss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Win/Loss Ratio:</span>
                      <span>{filteredStats.avgLoss > 0 ? (filteredStats.avgWin / filteredStats.avgLoss).toFixed(2) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Wins:</span>
                      <span className="text-green-600">{formatCurrency(filteredStats.avgWin * filteredStats.winningTrades)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Losses:</span>
                      <span className="text-red-600">{formatCurrency(filteredStats.avgLoss * filteredStats.losingTrades)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => toggleStatsCardExpansion('options')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Options Activity
                {expandedStatsCards.has('options') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredStats.optionTrades}</div>
              <p className="text-xs text-muted-foreground">
                option trades
              </p>
              {expandedStatsCards.has('options') && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Stock Trades:</span>
                      <span>{filteredStats.stockTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Option Trades:</span>
                      <span>{filteredStats.optionTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Option %:</span>
                      <span>{filteredStats.totalTrades > 0 ? ((filteredStats.optionTrades / filteredStats.totalTrades) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stock %:</span>
                      <span>{filteredStats.totalTrades > 0 ? ((filteredStats.stockTrades / filteredStats.totalTrades) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => toggleStatsCardExpansion('activity')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Total Activity
                {expandedStatsCards.has('activity') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredStats.totalTrades}</div>
              <p className="text-xs text-muted-foreground">
                Fees: {formatCurrency(filteredStats.totalFees)}
              </p>
              {expandedStatsCards.has('activity') && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <div className="text-xs">
                    <div className="font-medium mb-2">Top Symbols:</div>
                    <div className="space-y-1">
                      {Object.entries(filteredStats.symbolBreakdown).map(([symbol, data]) => (
                        <div key={symbol} className="flex justify-between items-center">
                          <span className="font-medium">{symbol}</span>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span>{data.trades} trades</span>
                              <span className={data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(data.pnl)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {Object.keys(filteredStats.symbolBreakdown).length === 0 && (
                        <div className="text-muted-foreground">No closed trades</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Account:</label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts && accounts.length > 0 ? accounts.map((account: any) => {
                // Try different possible name fields from the SnapTrade API
                const accountName = account.name || 
                                  account.account_name || 
                                  account.nickname || 
                                  account.institution_name || 
                                  account.number || 
                                  `Account ${account.id.slice(-4)}` || 
                                  'Unknown Account';
                
                console.log('Rendering account:', { id: account.id, name: accountName, fullAccount: account });
                
                return (
                  <SelectItem key={account.id} value={account.id}>
                    {accountName}
                  </SelectItem>
                );
              }) : (
                <SelectItem value="loading" disabled>
                  Loading accounts...
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Type:</label>
          <Select value={selectedType} onValueChange={(value) => setSelectedType(value as 'all' | 'stocks' | 'options')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="stocks">Stocks</SelectItem>
              <SelectItem value="options">Options</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Results:</label>
          <Select value={selectedPnL} onValueChange={(value) => setSelectedPnL(value as 'all' | 'wins' | 'losses' | 'closed' | 'open')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="wins">Wins only</SelectItem>
              <SelectItem value="losses">Losses only</SelectItem>
              <SelectItem value="closed">Closed only</SelectItem>
              <SelectItem value="open">Open only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {groupedTrades.length} positions ({filteredTrades.length} individual trades)
        </div>
      </div>

      {/* Enhanced Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Activity</CardTitle>
          <CardDescription>
            All your trading activity including stocks and options. Click any trade to add journal notes.
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
          ) : groupedTrades.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {tradesArray.length === 0 ? 'No trades found for the selected period.' : 'No trades match the selected filters.'}
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
                    <TableHead>Status</TableHead>
                    <TableHead>Journal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedTrades.map((groupedTrade) => {
                    const isExpanded = expandedTrades.has(groupedTrade.id);
                    const hasJournal = groupedTrade.trades.some(trade => 
                      journalEntries?.some((entry: JournalEntry) => entry.tradeId === trade.id)
                    );
                    
                    return (
                      <React.Fragment key={groupedTrade.id}>
                        {/* Main grouped trade row */}
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleTradeExpansion(groupedTrade.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <div>
                                <div className="font-medium">
                                  {format(groupedTrade.executedAt, 'MMM dd, yyyy')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {groupedTrade.trades.length} trade{groupedTrade.trades.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div>
                              <div className="font-medium">{groupedTrade.symbol}</div>
                              {groupedTrade.isOption && groupedTrade.optionDetails && (
                                <div className="text-xs text-muted-foreground">
                                  {groupedTrade.optionDetails.type} ${groupedTrade.optionDetails.strike} {format(new Date(groupedTrade.optionDetails.expiration), 'MMM dd')}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant={groupedTrade.isOption ? 'secondary' : 'default'}>
                              {groupedTrade.isOption ? 'Option' : 'Stock'}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium">
                                {groupedTrade.status === 'closed' ? 'Round Trip' : 'Position'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {groupedTrade.trades.filter(t => t.action === 'BUY').length} buys, {groupedTrade.trades.filter(t => t.action === 'SELL').length} sells
                              </span>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right">{groupedTrade.totalUnits}</TableCell>
                          
                          <TableCell className="text-right">
                            <div>
                              <div className="font-medium">{formatCurrency(groupedTrade.averageEntryPrice)}</div>
                              {groupedTrade.averageExitPrice && (
                                <div className="text-xs text-muted-foreground">
                                  Exit: {formatCurrency(groupedTrade.averageExitPrice)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right">
                            {formatCurrency(groupedTrade.totalValue)}
                          </TableCell>
                        
                          <TableCell className="text-right">
                            {groupedTrade.realizedPnL !== undefined ? (
                              <div className={groupedTrade.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(groupedTrade.realizedPnL)}
                                {groupedTrade.averageEntryPrice && groupedTrade.averageExitPrice && (
                                  <div className="text-xs">
                                    {formatPercent(((groupedTrade.averageExitPrice - groupedTrade.averageEntryPrice) / groupedTrade.averageEntryPrice) * 100)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge 
                                variant="outline" 
                                className={
                                  groupedTrade.status === 'closed' ? 'border-green-200 text-green-700' :
                                  groupedTrade.status === 'partial' ? 'border-yellow-200 text-yellow-700' :
                                  'border-gray-200 text-gray-700'
                                }
                              >
                                {groupedTrade.status}
                              </Badge>
                              {groupedTrade.holdingPeriod && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Timer className="h-3 w-3" />
                                  {groupedTrade.holdingPeriod}d
                                </div>
                              )}
                            </div>
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
                        
                        {/* Expanded individual trades */}
                        {isExpanded && groupedTrade.trades.map((trade, index) => (
                          <TableRow 
                            key={`${groupedTrade.id}-${trade.id}`}
                            className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJournalOpen(trade);
                            }}
                          >
                            <TableCell className="pl-8">
                              <div className="text-sm">
                                <div className="font-medium">
                                  {format(trade.executedAt, 'MMM dd, HH:mm')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Trade #{index + 1}
                                </div>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {trade.action} {trade.units} @ {formatCurrency(trade.price)}
                              </span>
                            </TableCell>
                            
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={trade.action === 'BUY' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}
                              >
                                {trade.action}
                              </Badge>
                            </TableCell>
                            
                            <TableCell className="text-sm text-muted-foreground">
                              Individual
                            </TableCell>
                            
                            <TableCell className="text-right text-sm">
                              {trade.units}
                            </TableCell>
                            
                            <TableCell className="text-right text-sm">
                              {formatCurrency(trade.price)}
                            </TableCell>
                            
                            <TableCell className="text-right text-sm">
                              {formatCurrency(trade.totalValue)}
                            </TableCell>
                            
                            <TableCell className="text-right text-sm">
                              {trade.realizedPnL !== undefined ? (
                                <span className={trade.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatCurrency(trade.realizedPnL)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            <TableCell className="text-sm">
                              <Badge variant="outline">
                                {trade.status}
                              </Badge>
                            </TableCell>
                            
                            <TableCell>
                              {journalEntries?.some((entry: JournalEntry) => entry.tradeId === trade.id) ? (
                                <Badge variant="outline" className="gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  Note
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-muted-foreground">
                                  <FileText className="h-3 w-3" />
                                  Add
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Journal Dialog */}
      <Dialog open={isJournalOpen} onOpenChange={setIsJournalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trade Journal Entry</DialogTitle>
          </DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              {/* Enhanced Trade Summary */}
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
                      <Badge className={getActionBadgeColor(selectedTrade.action)} variant="outline">
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
                    <div>
                      <span className="text-muted-foreground">Type:</span>{' '}
                      <Badge variant={selectedTrade.isOption ? 'secondary' : 'default'}>
                        {selectedTrade.isOption ? 'Option' : 'Stock'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <Badge variant="outline">{selectedTrade.status}</Badge>
                    </div>
                    {selectedTrade.isOption && selectedTrade.optionDetails && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Strike:</span>{' '}
                          <span className="font-medium">${selectedTrade.optionDetails.strike}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expiration:</span>{' '}
                          <span className="font-medium">
                            {format(new Date(selectedTrade.optionDetails.expiration), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </>
                    )}
                    {selectedTrade.realizedPnL !== undefined && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Entry:</span>{' '}
                          <span className="font-medium">{formatCurrency(selectedTrade.entryPrice || 0)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Exit:</span>{' '}
                          <span className="font-medium">{formatCurrency(selectedTrade.exitPrice || 0)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">P&L:</span>{' '}
                          <span className={`font-medium ${selectedTrade.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(selectedTrade.realizedPnL)}
                          </span>
                        </div>
                        {selectedTrade.holdingPeriod && (
                          <div>
                            <span className="text-muted-foreground">Holding Period:</span>{' '}
                            <span className="font-medium">{selectedTrade.holdingPeriod} days</span>
                          </div>
                        )}
                      </>
                    )}
                    <div>
                      <span className="text-muted-foreground">Commission:</span>{' '}
                      <span className="font-medium">{formatCurrency(selectedTrade.fee)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Value:</span>{' '}
                      <span className="font-medium">{formatCurrency(selectedTrade.totalValue)}</span>
                    </div>
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
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Reflection prompts:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => addPromptToNotes(prompt)}
                        className="text-xs"
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
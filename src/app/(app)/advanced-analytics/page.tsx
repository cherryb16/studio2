'use client';

import { useState } from 'react';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { PaywallWrapper } from '@/components/paywall-wrapper';
import { 
  getAnalyticsActivities,
  type AnalyticsActivity 
} from '@/app/actions/snaptrade-trades-enhanced';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Wallet,
  CreditCard,
  Banknote,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  Gift,
  Percent,
  AlertCircle,
  Loader2,
  PieChart,
  BarChart3,
  Calendar,
  Target,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';

function AccountActivitiesContent() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedActivityType, setSelectedActivityType] = useState<string>('all');
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

  // Fetch accounts for filtering
  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery({
    queryKey: ['accounts', credentials?.snaptradeUserId, credentials?.userSecret],
    queryFn: async () => {
      console.log('Fetching accounts with credentials:', {
        snaptradeUserId: credentials!.snaptradeUserId,
        userSecret: credentials!.userSecret ? 'present' : 'missing'
      });
      const res = await fetch(`/api/snaptrade/accounts?snaptradeUserId=${credentials!.snaptradeUserId}&userSecret=${credentials!.userSecret}`);
      console.log('Accounts API response status:', res.status);
      if (!res.ok) {
        const errorData = await res.text();
        console.error('Accounts API error:', errorData);
        throw new Error(`Failed to fetch accounts: ${res.status}`);
      }
      const accountsData = await res.json();
      console.log('Accounts API data:', accountsData);
      return accountsData;
    },
    enabled: !!credentials?.snaptradeUserId && !!credentials?.userSecret,
  });

  // Fetch account activities
  const { data: activities, isLoading: activitiesLoading, error: activitiesError } = useQuery({
    queryKey: ['accountActivities', credentials?.snaptradeUserId, credentials?.userSecret, selectedPeriod, selectedAccount],
    queryFn: async () => {
      console.log('Fetching account activities with params:', {
        snaptradeUserId: credentials!.snaptradeUserId,
        userSecret: credentials!.userSecret ? 'present' : 'missing',
        startDate: selectedPeriod === 'all' ? 'undefined' : getStartDate(selectedPeriod)
      });
      const result = await getAnalyticsActivities(
        credentials!.snaptradeUserId,
        credentials!.userSecret,
        selectedPeriod === 'all' ? undefined : getStartDate(selectedPeriod),
        undefined, // endDate
        selectedAccount === 'all' ? undefined : selectedAccount
      );
      console.log('Account activities result:', result);
      return result;
    },
    enabled: !!credentials?.snaptradeUserId && !!credentials?.userSecret,
  });

  // Calculate filtered stats from the activities with memoization
  // This must be called at the top level, not inside any conditional logic
  const { activitiesArray, filteredStats } = React.useMemo(() => {
    // Filter activities based on account and activity type
    const filterActivities = (activities: any[]) => {
      if (!Array.isArray(activities)) return [];

      let filtered = activities;

      // Filter by account
      if (selectedAccount !== 'all') {
        filtered = filtered.filter(activity => activity.accountId === selectedAccount);
      }

      // Filter by activity type
      if (selectedActivityType !== 'all') {
        filtered = filtered.filter(activity => activity.type === selectedActivityType);
      }

      return filtered;
    };

    const filteredActivities = filterActivities(Array.isArray(activities) ? activities : []);
    
    if (!filteredActivities.length) {
      return { activitiesArray: filteredActivities, filteredStats: null };
    }
    
    const stats = {
      totalDividends: 0,
      totalContributions: 0,
      totalWithdrawals: 0,
      totalInterest: 0,
      totalFees: 0,
      totalREI: 0,
      totalStockDividends: 0,
      totalTransfers: 0,
      dividendActivities: 0,
      contributionActivities: 0,
      withdrawalActivities: 0,
      interestActivities: 0,
      feeActivities: 0,
      reiActivities: 0,
      stockDividendActivities: 0,
      transferActivities: 0,
      totalActivities: filteredActivities.length,
      netCashFlow: 0,
    };

    filteredActivities.forEach(activity => {
      switch (activity.type) {
        case 'DIVIDEND':
          stats.totalDividends += activity.amount;
          stats.dividendActivities++;
          stats.netCashFlow += activity.amount;
          break;
        case 'CONTRIBUTION':
          stats.totalContributions += activity.amount;
          stats.contributionActivities++;
          stats.netCashFlow += activity.amount;
          break;
        case 'WITHDRAWAL':
          stats.totalWithdrawals += activity.amount;
          stats.withdrawalActivities++;
          stats.netCashFlow -= activity.amount;
          break;
        case 'INTEREST':
          stats.totalInterest += activity.amount;
          stats.interestActivities++;
          stats.netCashFlow += activity.amount;
          break;
        case 'FEE':
          stats.totalFees += activity.amount;
          stats.feeActivities++;
          stats.netCashFlow -= activity.amount;
          break;
        case 'REI':
          stats.totalREI += activity.amount;
          stats.reiActivities++;
          break;
        case 'STOCK_DIVIDEND':
          stats.totalStockDividends += activity.amount;
          stats.stockDividendActivities++;
          break;
        case 'TRANSFER':
          stats.totalTransfers += activity.amount;
          stats.transferActivities++;
          break;
      }
    });

    return { activitiesArray: filteredActivities, filteredStats: stats };
  }, [activities, selectedAccount, selectedActivityType]);

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

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'BUY': return <TrendingUp className="h-4 w-4" />;
      case 'SELL': return <TrendingDown className="h-4 w-4" />;
      case 'OPTIONEXPIRATION': return <Calendar className="h-4 w-4" />;
      case 'OPTIONASSIGNMENT': return <Target className="h-4 w-4" />;
      case 'OPTIONEXERCISE': return <Zap className="h-4 w-4" />;
      case 'DIVIDEND': return <Gift className="h-4 w-4" />;
      case 'CONTRIBUTION': return <ArrowUpRight className="h-4 w-4" />;
      case 'WITHDRAWAL': return <ArrowDownLeft className="h-4 w-4" />;
      case 'INTEREST': return <Percent className="h-4 w-4" />;
      case 'FEE': return <Receipt className="h-4 w-4" />;
      case 'TRANSFER': return <Repeat className="h-4 w-4" />;
      case 'REI': return <TrendingUp className="h-4 w-4" />;
      case 'STOCK_DIVIDEND': return <Gift className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case 'BUY': return 'bg-green-100 text-green-800 border-green-200';
      case 'SELL': return 'bg-red-100 text-red-800 border-red-200';
      case 'OPTIONEXPIRATION': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'OPTIONASSIGNMENT': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'OPTIONEXERCISE': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DIVIDEND': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CONTRIBUTION': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'WITHDRAWAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'INTEREST': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'FEE': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'TRANSFER': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'REI': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'STOCK_DIVIDEND': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };


  if (!user || !credentials) {
    return (
      <Card className="max-w-md mx-auto mt-32">
        <CardHeader>
          <CardTitle>Connect Your Brokerage</CardTitle>
          <CardDescription>
            Please connect your brokerage account to view advanced analytics.
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

  const hasError = activities && 'error' in activities;
  
  // Debug logging
  console.log('Activities data:', activities);
  console.log('Activities error:', activitiesError);
  console.log('Has error:', hasError);
  console.log('Activities array length:', activitiesArray.length);
  console.log('Filtered stats:', filteredStats);
  console.log('Accounts data:', accounts);
  console.log('Accounts loading:', accountsLoading);
  console.log('Accounts error:', accountsError);
  console.log('Accounts is array:', Array.isArray(accounts));
  console.log('Accounts length:', accounts && Array.isArray(accounts) ? accounts.length : 'not array');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Activities</h1>
        <p className="text-muted-foreground">
          Track dividends, contributions, withdrawals, and other non-trading account activities
        </p>
      </div>

      {/* Enhanced Summary Stats - Filtered */}
      {filteredStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Show all cards when no specific activity type is selected */}
          {selectedActivityType === 'all' ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Dividends</CardTitle>
                  <Gift className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(filteredStats.totalDividends)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredStats.dividendActivities} payments
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Contributions</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(filteredStats.totalContributions - filteredStats.totalWithdrawals)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredStats.contributionActivities} in, {filteredStats.withdrawalActivities} out
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Interest Earned</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(filteredStats.totalInterest)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredStats.interestActivities} payments
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${filteredStats.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(filteredStats.netCashFlow)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredStats.totalActivities} activities
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            /* Show focused cards when specific activity type is selected */
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {selectedActivityType === 'DIVIDEND' && 'Dividend Total'}
                    {selectedActivityType === 'CONTRIBUTION' && 'Contribution Total'}
                    {selectedActivityType === 'WITHDRAWAL' && 'Withdrawal Total'}
                    {selectedActivityType === 'INTEREST' && 'Interest Total'}
                    {selectedActivityType === 'FEE' && 'Fee Total'}
                    {selectedActivityType === 'TRANSFER' && 'Transfer Total'}
                    {selectedActivityType === 'REI' && 'Reinvestment Total'}
                    {selectedActivityType === 'STOCK_DIVIDEND' && 'Stock Dividend Total'}
                  </CardTitle>
                  {getActivityIcon(selectedActivityType)}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    ['CONTRIBUTION', 'DIVIDEND', 'INTEREST', 'REI', 'STOCK_DIVIDEND'].includes(selectedActivityType)
                      ? 'text-green-600'
                      : ['WITHDRAWAL', 'FEE'].includes(selectedActivityType)
                      ? 'text-red-600'
                      : ''
                  }`}>
                    {selectedActivityType === 'DIVIDEND' && formatCurrency(filteredStats.totalDividends)}
                    {selectedActivityType === 'CONTRIBUTION' && formatCurrency(filteredStats.totalContributions)}
                    {selectedActivityType === 'WITHDRAWAL' && formatCurrency(filteredStats.totalWithdrawals)}
                    {selectedActivityType === 'INTEREST' && formatCurrency(filteredStats.totalInterest)}
                    {selectedActivityType === 'FEE' && formatCurrency(filteredStats.totalFees)}
                    {selectedActivityType === 'TRANSFER' && formatCurrency(filteredStats.totalTransfers)}
                    {selectedActivityType === 'REI' && formatCurrency(filteredStats.totalREI)}
                    {selectedActivityType === 'STOCK_DIVIDEND' && formatCurrency(filteredStats.totalStockDividends)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredStats.totalActivities} activities
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Time Period</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedAccount === 'all' ? 'All accounts' : 'Single account'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredStats.totalActivities > 0 && (
                      formatCurrency(
                        (selectedActivityType === 'DIVIDEND' && filteredStats.totalDividends / filteredStats.dividendActivities) ||
                        (selectedActivityType === 'CONTRIBUTION' && filteredStats.totalContributions / filteredStats.contributionActivities) ||
                        (selectedActivityType === 'WITHDRAWAL' && filteredStats.totalWithdrawals / filteredStats.withdrawalActivities) ||
                        (selectedActivityType === 'INTEREST' && filteredStats.totalInterest / filteredStats.interestActivities) ||
                        (selectedActivityType === 'FEE' && filteredStats.totalFees / filteredStats.feeActivities) ||
                        (selectedActivityType === 'TRANSFER' && filteredStats.totalTransfers / filteredStats.transferActivities) ||
                        (selectedActivityType === 'REI' && filteredStats.totalREI / filteredStats.reiActivities) ||
                        (selectedActivityType === 'STOCK_DIVIDEND' && filteredStats.totalStockDividends / filteredStats.stockDividendActivities) ||
                        0
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Per transaction
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Activity Count</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredStats.totalActivities}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedActivityType.toLowerCase()} transactions
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Show message when no activities match filters */}
      {!filteredStats && !activitiesLoading && !hasError && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No activities match the selected filters</p>
          </CardContent>
        </Card>
      )}

      {/* Filtering Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          {/* Period Filter */}
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
          
          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
            title="Filter by account"
            aria-label="Filter by account"
            disabled={accountsLoading}
          >
            <option value="all">
              {accountsLoading ? 'Loading accounts...' : 'All Accounts'}
            </option>
            {accountsError && (
              <option value="all" disabled>
                Error loading accounts
              </option>
            )}
            {accounts && Array.isArray(accounts) && accounts.map((account: any) => (
              <option key={account.id} value={account.id}>
                {account.name || account.number || account.id}
              </option>
            ))}
            {!accountsLoading && !accountsError && (!accounts || !Array.isArray(accounts) || accounts.length === 0) && (
              <option value="all" disabled>
                No accounts found
              </option>
            )}
          </select>
          
          {/* Activity Type Filter */}
          <select
            value={selectedActivityType}
            onChange={(e) => setSelectedActivityType(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
            title="Filter by activity type"
            aria-label="Filter by activity type"
          >
            <option value="all">All Types</option>
            <option value="DIVIDEND">Dividends</option>
            <option value="CONTRIBUTION">Contributions</option>
            <option value="WITHDRAWAL">Withdrawals</option>
            <option value="INTEREST">Interest</option>
            <option value="FEE">Fees</option>
            <option value="TRANSFER">Transfers</option>
            <option value="REI">Dividend Reinvestment</option>
            <option value="STOCK_DIVIDEND">Stock Dividends</option>
          </select>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {activitiesArray.length} activities
        </div>
      </div>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>Non-Trading Account Activity</CardTitle>
          <CardDescription>
            Complete history of dividends, contributions, withdrawals, and other non-trading activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : hasError ? (
            <p className="text-center text-muted-foreground py-8">
              Error loading activities. Please try again.
            </p>
          ) : activitiesArray.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No activities found for the selected filters.
            </p>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activitiesArray.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {format(activity.executedAt, 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(activity.executedAt, 'HH:mm:ss')}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          className={getActivityBadgeColor(activity.type)}
                          variant="outline"
                        >
                          <div className="flex items-center gap-1">
                            {getActivityIcon(activity.type)}
                            {activity.type}
                          </div>
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="max-w-[250px] truncate" title={activity.description}>
                          {activity.description}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {activity.symbol ? (
                          <Badge variant="outline">{activity.symbol}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <span className={
                          ['CONTRIBUTION', 'DIVIDEND', 'INTEREST', 'REI', 'STOCK_DIVIDEND'].includes(activity.type)
                            ? 'text-green-600 font-medium'
                            : ['WITHDRAWAL', 'FEE'].includes(activity.type)
                            ? 'text-red-600 font-medium'
                            : 'font-medium'
                        }>
                          {formatCurrency(activity.amount, activity.currency)}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {accounts && Array.isArray(accounts) && accounts.find((acc: any) => acc.id === activity.accountId)?.name || activity.accountId}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccountActivitiesPage() {
  return (
    <PaywallWrapper 
      requiredPlan="pro" 
      feature="Account Activities"
      description="Track and analyze all your non-trading account activities including dividends, contributions, withdrawals, and more."
    >
      <AccountActivitiesContent />
    </PaywallWrapper>
  );
}
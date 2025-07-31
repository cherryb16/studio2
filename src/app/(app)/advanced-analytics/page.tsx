'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { 
  getAnalyticsActivities, 
  getAnalyticsSummaryStats,
  type AnalyticsActivity 
} from '@/app/actions/snaptrade-trades-enhanced';
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
  Target
} from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AdvancedAnalyticsPage() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [activeTab, setActiveTab] = useState('overview');

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

  // Fetch analytics activities
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['analyticsActivities', credentials?.snaptradeUserId, credentials?.userSecret, selectedPeriod],
    queryFn: () => getAnalyticsActivities(
      credentials!.snaptradeUserId,
      credentials!.userSecret,
      selectedPeriod === 'all' ? undefined : getStartDate(selectedPeriod)
    ),
    enabled: !!credentials?.snaptradeUserId && !!credentials?.userSecret,
  });

  // Fetch analytics statistics
  const { data: stats } = useQuery({
    queryKey: ['analyticsStats', credentials?.snaptradeUserId, credentials?.userSecret, selectedPeriod],
    queryFn: () => getAnalyticsSummaryStats(
      credentials!.snaptradeUserId,
      credentials!.userSecret,
      selectedPeriod
    ),
    enabled: !!credentials?.snaptradeUserId && !!credentials?.userSecret,
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

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
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
      case 'DIVIDEND': return 'bg-green-100 text-green-800 border-green-200';
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

  // Prepare chart data
  const prepareChartData = () => {
    if (!activities || !Array.isArray(activities)) return [];
    
    const monthlyData = activities.reduce((acc: any, activity) => {
      const month = format(activity.executedAt, 'MMM yyyy');
      if (!acc[month]) {
        acc[month] = {
          month,
          dividends: 0,
          contributions: 0,
          withdrawals: 0,
          interest: 0,
          fees: 0,
        };
      }
      
      switch (activity.type) {
        case 'DIVIDEND':
          acc[month].dividends += activity.amount;
          break;
        case 'CONTRIBUTION':
          acc[month].contributions += activity.amount;
          break;
        case 'WITHDRAWAL':
          acc[month].withdrawals += activity.amount;
          break;
        case 'INTEREST':
          acc[month].interest += activity.amount;
          break;
        case 'FEE':
          acc[month].fees += activity.amount;
          break;
      }
      
      return acc;
    }, {});
    
    return Object.values(monthlyData).slice(-12); // Last 12 months
  };

  // Prepare pie chart data for activity types
  const preparePieData = () => {
    if (!stats || 'error' in stats) return [];
    
    return [
      { name: 'Dividends', value: stats.totalDividends, count: stats.dividendActivities },
      { name: 'Contributions', value: stats.totalContributions, count: stats.contributionActivities },
      { name: 'Withdrawals', value: stats.totalWithdrawals, count: stats.withdrawalActivities },
      { name: 'Interest', value: stats.totalInterest, count: stats.interestActivities },
      { name: 'Fees', value: stats.totalFees, count: stats.feeActivities },
    ].filter(item => item.value > 0);
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

  const activitiesArray = Array.isArray(activities) ? activities : [];
  const hasError = activities && 'error' in activities;
  const chartData = prepareChartData();
  const pieData = preparePieData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Advanced Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive view of dividends, contributions, withdrawals, and other account activity
        </p>
      </div>

      {/* Enhanced Summary Stats */}
      {stats && !('error' in stats) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Dividends</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalDividends)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.dividendActivities} payments
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
                {formatCurrency(stats.totalContributions - stats.totalWithdrawals)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.contributionActivities} in, {stats.withdrawalActivities} out
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
                {formatCurrency(stats.totalInterest)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.interestActivities} payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.totalFees)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.feeActivities} charges
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Combined Period Selector and Tabs */}
      <div className="flex flex-wrap gap-4 justify-between items-end">
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex gap-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="dividends">Dividends</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="activity">All Activity</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Activity Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Trends</CardTitle>
                <CardDescription>Monthly breakdown of account activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Line type="monotone" dataKey="dividends" stroke="#10B981" strokeWidth={2} />
                      <Line type="monotone" dataKey="contributions" stroke="#3B82F6" strokeWidth={2} />
                      <Line type="monotone" dataKey="interest" stroke="#F59E0B" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Activity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>Breakdown by activity type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dividends Tab */}
        <TabsContent value="dividends" className="space-y-6">
          {stats && !('error' in stats) && stats.topDividendPayers.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Dividend Payers</CardTitle>
                <CardDescription>Companies providing the most dividend income</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(stats.topDividendPayers.entries())
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([symbol, amount], index) => (
                      <div key={symbol} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="font-medium">{symbol}</div>
                          <Badge variant="outline">#{index + 1}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">{formatCurrency(amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {stats.totalDividends > 0 && ((amount / stats.totalDividends) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cashflow" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cash Inflows</CardTitle>
                <CardDescription>Money coming into your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats && !('error' in stats) && (
                  <>
                    <div className="flex justify-between items-center">
                      <span>Contributions</span>
                      <span className="font-medium text-blue-600">{formatCurrency(stats.totalContributions)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Dividends</span>
                      <span className="font-medium text-green-600">{formatCurrency(stats.totalDividends)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Interest</span>
                      <span className="font-medium text-yellow-600">{formatCurrency(stats.totalInterest)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between items-center font-bold">
                      <span>Total Inflows</span>
                      <span className="text-green-600">
                        {formatCurrency(stats.totalContributions + stats.totalDividends + stats.totalInterest)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cash Outflows</CardTitle>
                <CardDescription>Money leaving your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats && !('error' in stats) && (
                  <>
                    <div className="flex justify-between items-center">
                      <span>Withdrawals</span>
                      <span className="font-medium text-red-600">{formatCurrency(stats.totalWithdrawals)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Fees</span>
                      <span className="font-medium text-orange-600">{formatCurrency(stats.totalFees)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between items-center font-bold">
                      <span>Total Outflows</span>
                      <span className="text-red-600">
                        {formatCurrency(stats.totalWithdrawals + stats.totalFees)}
                      </span>
                    </div>
                    <hr />
                    <div className="flex justify-between items-center font-bold text-lg">
                      <span>Net Cash Flow</span>
                      <span className={
                        (stats.totalContributions + stats.totalDividends + stats.totalInterest - stats.totalWithdrawals - stats.totalFees) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }>
                        {formatCurrency(
                          stats.totalContributions + stats.totalDividends + stats.totalInterest - stats.totalWithdrawals - stats.totalFees
                        )}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>All Account Activity</CardTitle>
              <CardDescription>
                Complete history of non-trading account activity
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
                  No activities found for the selected period.
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
                        <TableHead>Currency</TableHead>
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
                            <div className="max-w-[200px] truncate" title={activity.description}>
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
                                ? 'text-green-600'
                                : ['WITHDRAWAL', 'FEE'].includes(activity.type)
                                ? 'text-red-600'
                                : ''
                            }>
                              {formatCurrency(activity.amount, activity.currency)}
                            </span>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant="outline">{activity.currency}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
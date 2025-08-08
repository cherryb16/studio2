'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { PaywallWrapper } from '@/components/paywall-wrapper';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

// Dashboard components
import MainValueCards from '@/components/dashboard/MainValueCards';
import AssetAllocation from '@/components/dashboard/AssetAllocation';
import QuickStats from '@/components/dashboard/QuickStats';
import TopPositions from '@/components/dashboard/TopPositions';
// SectorAllocation removed - no longer using external sector data
import RiskSummary from '@/components/dashboard/RiskSummary';
import TaxOptimization from '@/components/dashboard/TaxOptimization';
import PerformanceSummary from '@/components/dashboard/PerformanceSummary';
import PerformanceAttribution from '@/components/dashboard/PerformanceAttribution';
import InsightsPlaceholder from '@/components/dashboard/InsightsPlaceholder';
import PerformanceChart from '@/components/dashboard/PerformanceChart';

import { getSnapTradeAccounts } from '@/app/actions/snaptrade';
import { getPortfolioAnalytics, getPerformanceMetrics, getRealizedGains } from '@/app/actions/snaptrade-enhanced';
import { generateRiskDashboard } from '@/app/actions/advanced-analytics';

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const firebaseUserId = user?.uid;
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: snaptradeCredentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ['snaptradeCredentials', firebaseUserId],
    queryFn: async () => {
      if (!firebaseUserId) throw new Error('...missing Firebase user ID');
      const res = await fetch(`/api/firebase/getCredentials?firebaseUserId=${firebaseUserId}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      return res.json();
    },
    enabled: !!firebaseUserId,
  });

  const snaptradeUserId = snaptradeCredentials?.snaptradeUserId;
  const userSecret = snaptradeCredentials?.userSecret;
  const enabled = !!snaptradeUserId && !!userSecret;

  const { data: accounts } = useQuery({
    queryKey: ['accounts', snaptradeUserId, userSecret],
    queryFn: () => getSnapTradeAccounts(snaptradeUserId!, userSecret!),
    enabled,
  });

  const { data: analytics } = useQuery({
    queryKey: ['analytics', snaptradeUserId, userSecret, selectedAccount],
    queryFn: () => getPortfolioAnalytics(snaptradeUserId!, userSecret!, selectedAccount),
    enabled,
  });

  const { data: riskDashboard, isLoading: riskLoading, error: riskError } = useQuery({
    queryKey: ['risk', snaptradeUserId, userSecret],
    queryFn: async () => {
      console.log('Fetching risk dashboard data...');
      const result = await generateRiskDashboard(snaptradeUserId!, userSecret!, 'moderate');
      console.log('Risk dashboard result:', result);
      return result;
    },
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: performanceMetrics, isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ['performanceMetrics', snaptradeUserId, userSecret],
    queryFn: async () => {
      console.log('Fetching performance metrics...');
      const result = await getPerformanceMetrics(snaptradeUserId!, userSecret!);
      console.log('Performance metrics result:', result);
      return result;
    },
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: realizedGains, isLoading: realizedGainsLoading, error: realizedGainsError } = useQuery({
    queryKey: ['realizedGains', snaptradeUserId, userSecret],
    queryFn: async () => {
      console.log('Fetching realized gains...');
      const result = await getRealizedGains(snaptradeUserId!, userSecret!);
      console.log('Realized gains result:', result);
      return result;
    },
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (authLoading || credentialsLoading) return <div>Loading...</div>;
  if (!user || !enabled) {
    return (
      <Card className="max-w-md mx-auto mt-32">
        <CardHeader><CardTitle>Connect Brokerage</CardTitle></CardHeader>
        <CardContent>
          <Link href="/settings"><Button>Connect Brokerage</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const isError = (d: any): d is { error: string } => d && typeof d === 'object' && 'error' in d;
  const accountList = isError(accounts) ? [] : accounts || [];
  const analyticsData = isError(analytics) ? null : analytics;
  const riskData = isError(riskDashboard) ? null : riskDashboard;
  const performanceData = isError(performanceMetrics) ? null : performanceMetrics;
  const realizedGainsData = isError(realizedGains) ? null : realizedGains;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Portfolio Dashboard</h1>
            <p className="text-muted">{user.displayName || user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <label htmlFor="accountSelect" className="sr-only">Select Account</label>
            <select
              id="accountSelect"
              title="Select Account"
              aria-label="Select Account"
              value={selectedAccount || 'all'}
              onChange={e => setSelectedAccount(e.target.value === 'all' ? undefined : e.target.value)}
              className="border rounded p-2"
            >
              <option value="all">All Accounts</option>
              {Array.isArray(accountList) &&
                accountList.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
            </select>
            <Link href="./advanced-analytics">
              <Button variant="outline"><BarChart3 className="mr-2 h-4 w-4" />Advanced Analytics</Button>
            </Link>
          </div>
        </div>

        <MainValueCards
          analyticsData={analyticsData}
          riskData={riskData}
          performanceData={performanceData}
          realizedGainsData={realizedGainsData}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5">
            {['overview','positions','risk','performance','insights'].map(tab => (
              <TabsTrigger key={tab} value={tab}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</TabsTrigger>
            ))}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <AssetAllocation />
              </div>
              <div>
                <QuickStats analyticsData={analyticsData} riskData={riskData} />
              </div>
            </div>
          </TabsContent>

          {/* Positions */}
          <TabsContent value="positions">
            <TopPositions analyticsData={analyticsData} />
            {/* SectorAllocation component removed - no longer using external sector data */}
          </TabsContent>

          {/* Risk */}
          <TabsContent value="risk">
            <PaywallWrapper requiredPlan="pro" feature="Risk Analysis" description="Advanced risk metrics and tax optimization strategies to help improve your portfolio performance.">
              {riskLoading ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <Card><CardContent className="p-6"><div className="animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div></div></CardContent></Card>
                  <Card><CardContent className="p-6"><div className="animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div></div></CardContent></Card>
                </div>
              ) : riskError ? (
                <Card><CardContent className="p-6 text-center text-red-600">Error loading risk data: {riskError.message}</CardContent></Card>
              ) : riskData ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <RiskSummary riskData={riskData} />
                  <TaxOptimization riskData={riskData} />
                </div>
              ) : (
                <Card><CardContent className="p-6 text-center text-muted-foreground">No risk data available. Please ensure you have positions in your connected accounts.</CardContent></Card>
              )}
            </PaywallWrapper>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance">
            {performanceLoading ? (
              <Card><CardContent className="p-6"><div className="animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div></div></CardContent></Card>
            ) : performanceError ? (
              <Card><CardContent className="p-6 text-center text-red-600">Error loading performance data: {performanceError.message}</CardContent></Card>
            ) : (
              <>
                <PerformanceSummary performanceData={performanceData} />
                <PaywallWrapper requiredPlan="pro" feature="Performance Attribution" description="Detailed performance breakdown and attribution analysis to understand what drives your returns.">
                  {riskData?.performanceAttribution && (
                    <PerformanceAttribution performanceAttribution={riskData.performanceAttribution} />
                  )}
                  {/* Pass performanceData to the chart */}
                  {performanceData && (
                    <PerformanceChart performanceData={performanceData} />
                  )}
                </PaywallWrapper>
              </>
            )}
          </TabsContent>

          {/* Insights */}
          <TabsContent value="insights">
            <InsightsPlaceholder />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
};

export default DashboardPage;
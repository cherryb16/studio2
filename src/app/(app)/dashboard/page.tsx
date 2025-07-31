'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
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
import SectorAllocation from '@/components/dashboard/SectorAllocation';
import RiskSummary from '@/components/dashboard/RiskSummary';
import TaxOptimization from '@/components/dashboard/TaxOptimization';
import PerformanceSummary from '@/components/dashboard/PerformanceSummary';
import PerformanceAttribution from '@/components/dashboard/PerformanceAttribution';
import InsightsPlaceholder from '@/components/dashboard/InsightsPlaceholder';
import PerformanceChart from '@/components/dashboard/PerformanceChart';

import { getSnapTradeAccounts } from '@/app/actions/snaptrade';
import { getPortfolioAnalytics, getPerformanceMetrics } from '@/app/actions/snaptrade-enhanced';
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

  const { data: riskDashboard } = useQuery({
    queryKey: ['risk', snaptradeUserId, userSecret],
    queryFn: () => generateRiskDashboard(snaptradeUserId!, userSecret!, 'moderate'),
    enabled,
  });

  const { data: performanceMetrics } = useQuery({
    queryKey: ['performanceMetrics', snaptradeUserId, userSecret],
    queryFn: () => getPerformanceMetrics(snaptradeUserId!, userSecret!, 'month'),
    enabled,
  });

  if (authLoading || credentialsLoading) return <div>Loading...</div>;
  if (!user || !enabled) {
    return (
      <Card className="max-w-md mx-auto mt-32">
        <CardHeader><CardTitle>Connect Brokerage</CardTitle></CardHeader>
        <CardContent>
          <Link href="/settings"><Button>Connect Account</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const isError = (d: any): d is { error: string } => d && typeof d === 'object' && 'error' in d;
  const accountList = isError(accounts) ? [] : accounts || [];
  const analyticsData = isError(analytics) ? null : analytics;
  const riskData = isError(riskDashboard) ? null : riskDashboard;
  const performanceData = isError(performanceMetrics) ? null : performanceMetrics;

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
                    {acc.name} ({acc.institution_name})
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
            {riskData?.sectorAnalysis && <SectorAllocation sectorAnalysis={riskData.sectorAnalysis} />}
          </TabsContent>

          {/* Risk */}
          <TabsContent value="risk">
            <div className="grid md:grid-cols-2 gap-4">
              <RiskSummary riskData={riskData} />
              <TaxOptimization riskData={riskData} />
            </div>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance">
            <PerformanceSummary performanceData={performanceData} />
            {riskData?.performanceAttribution && (
              <PerformanceAttribution performanceAttribution={riskData.performanceAttribution} />
            )}
            {/* Only pass analyticsData when it's not null */}
            {analyticsData && (
              <PerformanceChart />
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
// src/app/dashboard/portfolio/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { 
  getDashboardSummary,
  getPortfolioAnalytics,
  calculatePortfolioHealthScore,
  generateRiskDashboard,
  exportPortfolioData,
  checkPortfolioAlerts,
  compareWithBenchmarks
} from '@/app/actions/portfolio-utilities';

// ==================== MAIN PORTFOLIO DASHBOARD COMPONENT ====================

export default function PortfolioDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'risk' | 'alerts'>('overview');

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get SnapTrade credentials
      const credRes = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
      const credentials = credRes.ok ? await credRes.json() : null;
      if (!credentials) {
        setError('SnapTrade credentials not found. Please connect your account.');
        return;
      }

      // Load dashboard summary
      const summary = await getDashboardSummary(
        credentials.snaptradeUserId,
        credentials.userSecret
      );

      if ((summary as any).error) {
        setError((summary as any).error);
        return;
      }

      setDashboardData(summary);
    } catch (err) {
      setError('Failed to load portfolio data');
      console.error('Dashboard loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      const credRes = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
      const credentials = credRes.ok ? await credRes.json() : null;
      if (!credentials) return;

      const exportData = await exportPortfolioData(
        credentials.snaptradeUserId,
        credentials.userSecret,
        format
      );

      if ((exportData as any).error) {
        setError((exportData as any).error);
        return;
      }

      // Download the exported data
      const blob = new Blob([JSON.stringify((exportData as any).data, null, 2)], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export portfolio data');
    }
  };

  if (loading) {
    return <PortfolioSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={loadDashboardData} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleExportData('csv')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExportData('json')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Export JSON
            </button>
            <button
              onClick={loadDashboardData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Portfolio Summary Cards */}
        <PortfolioSummaryCards data={dashboardData.summary} />

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'analytics', label: 'Analytics' },
            { key: 'risk', label: 'Risk Management' },
            { key: 'alerts', label: 'Alerts' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-3 font-medium ${
                activeTab === tab.key
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeTab === 'overview' && (
            <OverviewTab data={dashboardData} />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab userId={user.uid} />
          )}
          {activeTab === 'risk' && (
            <RiskManagementTab userId={user.uid} />
          )}
          {activeTab === 'alerts' && (
            <AlertsTab userId={user.uid} />
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== COMPONENT PIECES ====================

function PortfolioSummaryCards({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <SummaryCard
        title="Total Value"
        value={`$${data.totalValue.toLocaleString()}`}
        change={data.dayChangePercent}
        changeValue={`$${data.dayChange.toLocaleString()}`}
        positive={data.dayChange >= 0}
      />
      <SummaryCard
        title="Unrealized P&L"
        value={`$${data.unrealizedPnL.toLocaleString()}`}
        change={data.unrealizedPnLPercent}
        changeValue={`${data.unrealizedPnLPercent.toFixed(2)}%`}
        positive={data.unrealizedPnL >= 0}
      />
      <SummaryCard
        title="Health Score"
        value={`${data.healthScore}/100`}
        change={null}
        changeValue={data.grade}
        positive={data.healthScore >= 70}
      />
      <SummaryCard
        title="Active Alerts"
        value={data.alerts.count.toString()}
        change={null}
        changeValue={data.alerts.count > 0 ? 'Needs Attention' : 'All Clear'}
        positive={data.alerts.count === 0}
      />
    </div>
  );
}

function SummaryCard({ title, value, change, changeValue, positive }: any) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      {changeValue && (
        <div className={`text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {change !== null && (
            <span className="mr-1">
              {positive ? '↗' : '↘'} {Math.abs(change).toFixed(2)}%
            </span>
          )}
          {changeValue}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: any }) {
  return (
    <>
      {/* Portfolio Composition */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Portfolio Composition</h3>
          <PortfolioCompositionChart data={data.composition} />
        </div>
      </div>

      {/* Top Positions */}
      <div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Top Positions</h3>
          <div className="space-y-3">
            {data.topPositions.map((position: any, index: number) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{position.symbol}</div>
                  <div className="text-sm text-gray-500">{position.description}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${position.value.toLocaleString()}</div>
                  <div className={`text-sm ${
                    position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {position.unrealizedPnLPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="lg:col-span-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Positions"
            value={data.quickStats.totalPositions}
            subtitle="Holdings"
          />
          <StatCard
            title="Asset Classes"
            value={data.quickStats.assetClasses}
            subtitle="Diversified"
          />
          <StatCard
            title="Concentration Risk"
            value={`${data.quickStats.concentrationRisk.toFixed(1)}%`}
            subtitle="Top Position"
          />
        </div>
      </div>
    </>
  );
}

function AnalyticsTab({ userId }: { userId: string }) {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const credRes = await fetch(`/api/firebase/getCredentials?firebaseUserId=${userId}`);
      const credentials = credRes.ok ? await credRes.json() : null;
      if (!credentials) return;

      const analytics = await getPortfolioAnalytics(
        credentials.snaptradeUserId,
        credentials.userSecret
      );

      setAnalyticsData(analytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading analytics...</div>;
  if (!analyticsData) return <div>No analytics data available</div>;

  return (
    <>
      {/* Performance Metrics */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Performance Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                ${analyticsData.unrealizedPnL.total.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Unrealized P&L</div>
              <div className={`text-lg font-semibold ${
                analyticsData.unrealizedPnL.totalPercentage >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {analyticsData.unrealizedPnL.totalPercentage.toFixed(2)}%
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                ${analyticsData.assetBalances.equities.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Equities Value</div>
              <div className={`text-lg font-semibold ${
                analyticsData.unrealizedPnL.equitiesPercentage >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {analyticsData.unrealizedPnL.equitiesPercentage.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Allocation */}
      <div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Asset Allocation</h3>
          <div className="space-y-3">
            {Object.entries(analyticsData.composition).map(([asset, percentage]: [string, any]) => (
              <div key={asset} className="flex justify-between items-center">
                <span className="capitalize font-medium">{asset}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Diversification Analysis */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Diversification Metrics</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {analyticsData.diversification.totalPositions}
              </div>
              <div className="text-sm text-gray-600">Total Positions</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {analyticsData.diversification.assetClasses}
              </div>
              <div className="text-sm text-gray-600">Asset Classes</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                ${analyticsData.diversification.averagePositionSize.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Avg Position Size</div>
            </div>
          </div>
        </div>
      </div>

      {/* Options Analysis */}
      {analyticsData.optionsMetrics.totalContracts > 0 && (
        <div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Options Portfolio</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Contracts</span>
                <span className="font-medium">{analyticsData.optionsMetrics.totalContracts}</span>
              </div>
              <div className="flex justify-between">
                <span>Call Contracts</span>
                <span className="font-medium">{analyticsData.optionsMetrics.callContracts}</span>
              </div>
              <div className="flex justify-between">
                <span>Put Contracts</span>
                <span className="font-medium">{analyticsData.optionsMetrics.putContracts}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Premium</span>
                <span className="font-medium">${analyticsData.optionsMetrics.totalPremium.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Days to Expiry</span>
                <span className="font-medium">{analyticsData.optionsMetrics.averageTimeToExpiry.toFixed(0)} days</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RiskManagementTab({ userId }: { userId: string }) {
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    try {
      const credRes = await fetch(`/api/firebase/getCredentials?firebaseUserId=${userId}`);
      const credentials = credRes.ok ? await credRes.json() : null;
      if (!credentials) return;

      const riskDashboard = await generateRiskDashboard(
        credentials.snaptradeUserId,
        credentials.userSecret,
        'moderate'
      );

      setRiskData(riskDashboard);
    } catch (error) {
      console.error('Error loading risk data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading risk analysis...</div>;
  if (!riskData) return <div>No risk data available</div>;

  return (
    <>
      {/* Risk Summary */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Risk Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <RiskMetricCard
              title="Overall Risk Score"
              value={riskData.riskSummary.overallRiskScore}
              maxValue={10}
              type="risk"
            />
            <RiskMetricCard
              title="Diversification Score"
              value={riskData.riskSummary.diversificationScore}
              maxValue={10}
              type="positive"
            />
            <RiskMetricCard
              title="Concentration Risk"
              value={riskData.riskSummary.concentrationRisk.violations?.length || 0}
              maxValue={null}
              type="count"
            />
            <RiskMetricCard
              title="Correlation Risk"
              value={riskData.riskSummary.correlationRisk.level}
              maxValue={null}
              type="level"
            />
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Action Items</h3>
          <div className="space-y-3">
            {riskData.actionItems.map((item: any, index: number) => (
              <div key={index} className={`p-3 rounded-lg border-l-4 ${
                item.priority === 'high' ? 'border-red-500 bg-red-50' :
                item.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium capitalize">{item.category.replace('_', ' ')}</div>
                    <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                    <div className="text-sm font-medium mt-2">{item.action}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.priority === 'high' ? 'bg-red-100 text-red-800' :
                    item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tax Optimization */}
      <div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Tax Optimization</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Unrealized Losses</span>
              <span className="font-medium text-red-600">
                ${riskData.taxOptimization.totalUnrealizedLosses.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Unrealized Gains</span>
              <span className="font-medium text-green-600">
                ${riskData.taxOptimization.totalUnrealizedGains.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Harvestable Amount</span>
              <span className="font-medium">
                ${riskData.taxOptimization.harvestableAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Loss Opportunities</span>
              <span className="font-medium">
                {riskData.taxOptimization.taxLossOpportunities.length} positions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ESG Analysis */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">ESG Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-800">
                  {riskData.esgAnalysis.portfolioESGScores.environmental.toFixed(0)}
                </div>
                <div className="text-sm text-green-600">Environmental</div>
              </div>
            </div>
            <div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-800">
                  {riskData.esgAnalysis.portfolioESGScores.social.toFixed(0)}
                </div>
                <div className="text-sm text-blue-600">Social</div>
              </div>
            </div>
            <div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-800">
                  {riskData.esgAnalysis.portfolioESGScores.governance.toFixed(0)}
                </div>
                <div className="text-sm text-purple-600">Governance</div>
              </div>
            </div>
            <div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-800">
                  {riskData.esgAnalysis.esgRating}
                </div>
                <div className="text-sm text-gray-600">Overall Rating</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function AlertsTab({ userId }: { userId: string }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const credRes = await fetch(`/api/firebase/getCredentials?firebaseUserId=${userId}`);
      const credentials = credRes.ok ? await credRes.json() : null;
      if (!credentials) return;

      const alertData = await checkPortfolioAlerts(
        userId,
        credentials.snaptradeUserId,
        credentials.userSecret
      );

      setAlerts((alertData as any).alerts || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading alerts...</div>;

  return (
    <>
      <div className="lg:col-span-3">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Portfolio Alerts</h3>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Create Alert
            </button>
          </div>
          
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🎯</div>
              <div>No active alerts</div>
              <div className="text-sm">Your portfolio is within all defined thresholds</div>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert: any, index: number) => (
                <div key={index} className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'high' ? 'border-red-500 bg-red-50' :
                  'border-yellow-500 bg-yellow-50'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{alert.symbol}</div>
                      <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {alert.severity}
                      </span>
                      <button className="text-gray-400 hover:text-gray-600">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ==================== HELPER COMPONENTS ====================

function RiskMetricCard({ title, value, maxValue, type }: any) {
  const getColor = () => {
    if (type === 'risk') {
      return value <= 3 ? 'text-green-600' : value <= 6 ? 'text-yellow-600' : 'text-red-600';
    }
    if (type === 'positive') {
      return value >= 7 ? 'text-green-600' : value >= 4 ? 'text-yellow-600' : 'text-red-600';
    }
    if (type === 'level') {
      return value === 'low' ? 'text-green-600' : value === 'medium' ? 'text-yellow-600' : 'text-red-600';
    }
    return 'text-gray-600';
  };

  const displayValue = () => {
    if (type === 'level') return value.toUpperCase();
    if (maxValue) return `${value}/${maxValue}`;
    return value.toString();
  };

  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <div className={`text-xl font-bold ${getColor()}`}>
        {displayValue()}
      </div>
      <div className="text-sm text-gray-600 mt-1">{title}</div>
    </div>
  );
}

function StatCard({ title, value, subtitle }: any) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xs text-gray-400">{subtitle}</div>
    </div>
  );
}

function PortfolioCompositionChart({ data }: { data: any }) {
  const colors = {
    cash: '#10B981',
    equities: '#3B82F6', 
    options: '#8B5CF6',
    crypto: '#F59E0B',
    other: '#6B7280'
  };

  return (
    <div className="space-y-4">
      {Object.entries(data).map(([asset, percentage]: [string, any]) => (
        <div key={asset} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: colors[asset as keyof typeof colors] }}
            />
            <span className="capitalize font-medium">{asset}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full" 
                style={{ 
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: colors[asset as keyof typeof colors]
                }}
              />
            </div>
            <span className="text-sm font-medium w-12 text-right">
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-6 shadow-sm">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-300 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-300 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorDisplay({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Portfolio</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
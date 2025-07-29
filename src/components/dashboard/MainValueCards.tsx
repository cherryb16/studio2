'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Wallet, TrendingUp, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function MainValueCards({ analyticsData, performanceData, riskData }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Portfolio Value */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Total Portfolio Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${analyticsData?.totalBalance?.toLocaleString() || '0'}
          </div>
          {performanceData?.totalReturnPercentage !== undefined && (
            <p className={`text-xs ${performanceData.totalReturnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {performanceData.totalReturnPercentage >= 0 ? <ArrowUpRight className="inline h-3 w-3" /> : <ArrowDownRight className="inline h-3 w-3" />}
              {Math.abs(performanceData.totalReturnPercentage).toFixed(2)}% this month
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cash Balance */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Cash Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${analyticsData?.cashBalance?.toLocaleString() || '0'}
          </div>
          <p className="text-xs text-muted-foreground">
            {analyticsData?.composition?.cash?.toFixed(1) || '0'}% of portfolio
          </p>
        </CardContent>
      </Card>

      {/* Unrealized P/L */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Total Unrealized P/L</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${analyticsData?.unrealizedPnL?.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {analyticsData?.unrealizedPnL?.total >= 0 ? '+' : '-'}
            ${Math.abs(analyticsData?.unrealizedPnL?.total || 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {analyticsData?.unrealizedPnL?.totalPercentage?.toFixed(2) || '0'}% return
          </p>
        </CardContent>
      </Card>

      {/* Risk Score */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Risk Score</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {riskData?.riskSummary?.overallRiskScore || 'N/A'}/10
          </div>
          <Progress value={(riskData?.riskSummary?.overallRiskScore || 0) * 10} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}
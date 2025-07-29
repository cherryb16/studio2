'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Activity, Calculator } from 'lucide-react';

export default function PerformanceSummary({ performanceData }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Month Return */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Month Return</CardTitle>
          <LineChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${performanceData?.totalReturnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {performanceData?.totalReturnPercentage >= 0 ? '+' : ''}
            {performanceData?.totalReturnPercentage?.toFixed(2) || '0'}%
          </div>
          <p className="text-xs text-muted-foreground">
            ${performanceData?.totalReturn?.toLocaleString() || '0'}
          </p>
        </CardContent>
      </Card>

      {/* Volatility */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Volatility</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performanceData?.volatility?.toFixed(2) || 'N/A'}%
          </div>
          <p className="text-xs text-muted-foreground">Standard deviation</p>
        </CardContent>
      </Card>

      {/* Sharpe Ratio */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Sharpe Ratio</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performanceData?.sharpeRatio?.toFixed(2) || 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">Risk-adjusted returns</p>
        </CardContent>
      </Card>
    </div>
  );
}
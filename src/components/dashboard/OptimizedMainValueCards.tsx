'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Wallet, TrendingUp, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface OptimizedMainValueCardsProps {
  dashboard: {
    totalBalance: number;
    totalCash: number;
    totalUnrealizedPnL: number;
    totalRealizedPnL: number;
    totalReturnPercentage: number;
  };
  composition: {
    cash: number;
  };
  quickStats: {
    winRate: number;
    totalTrades: number;
  };
  cached?: boolean;
}

export default function OptimizedMainValueCards({ 
  dashboard, 
  composition, 
  quickStats, 
  cached = false 
}: OptimizedMainValueCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Data freshness indicator */}
      {cached && (
        <div className="col-span-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Real-time cached data - Updates daily at midnight
          </div>
        </div>
      )}

      {/* Total Portfolio Value */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Total Portfolio Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(dashboard.totalBalance || 0)}
          </div>
          {dashboard.totalReturnPercentage !== undefined && (
            <p className={`text-xs ${dashboard.totalReturnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dashboard.totalReturnPercentage >= 0 ? 
                <ArrowUpRight className="inline h-3 w-3" /> : 
                <ArrowDownRight className="inline h-3 w-3" />
              }
              {Math.abs(dashboard.totalReturnPercentage).toFixed(2)}% total return
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
            {formatCurrency(dashboard.totalCash || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {composition.cash?.toFixed(1) || '0'}% of portfolio
          </p>
        </CardContent>
      </Card>

      {/* Unrealized P/L */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">Unrealized P/L</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            (dashboard.totalUnrealizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(dashboard.totalUnrealizedPnL || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Current open positions
          </p>
        </CardContent>
      </Card>

      {/* Realized P/L */}
      <Card>
        <CardHeader className="flex justify-between pb-2">
          <CardTitle className="text-sm">All-Time Realized P/L</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            (dashboard.totalRealizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(dashboard.totalRealizedPnL || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {quickStats.winRate?.toFixed(1) || '0'}% win rate ({quickStats.totalTrades || 0} trades)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
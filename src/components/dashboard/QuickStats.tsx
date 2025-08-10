'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/use-firestore-portfolio';

export default function QuickStats() {
  const analytics = useAnalytics();

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Quick Stats</CardTitle>
        <CardDescription>Key portfolio metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm">Total Positions</span>
          <Badge variant="secondary">
            {analytics.totalPositions || 0}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Asset Classes</span>
          <Badge variant="secondary">
            {Object.keys(analytics.positionsByType).length || 0}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Total Value</span>
          <Badge variant="secondary">
            ${analytics.totalValue?.toLocaleString() || 0}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Unrealized P&L</span>
          <Badge variant={analytics.totalUnrealizedPnL >= 0 ? "secondary" : "destructive"}>
            ${analytics.totalUnrealizedPnL?.toLocaleString() || 0}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Win Rate (Month)</span>
          <Badge variant="secondary">
            {analytics.thisMonth?.winRate?.toFixed(1) || 'N/A'}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
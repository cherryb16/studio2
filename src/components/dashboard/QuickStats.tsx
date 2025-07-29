'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function QuickStats({ analyticsData, riskData }: any) {
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
            {analyticsData?.diversification?.totalPositions || 0}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Asset Classes</span>
          <Badge variant="secondary">
            {analyticsData?.diversification?.assetClasses || 0}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Avg Position Size</span>
          <Badge variant="secondary">
            ${analyticsData?.diversification?.averagePositionSize?.toLocaleString() || 0}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Diversification Score</span>
          <Badge variant="secondary">
            {riskData?.riskSummary?.diversificationScore || 'N/A'}/10
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TopPositions({ analyticsData }: any) {
  const top = analyticsData?.topPositions?.slice(0, 10) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Positions</CardTitle>
        <CardDescription>Your largest holdings by market value</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {top.map((position: any, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-medium">{position.symbol}</div>
                <Badge variant="outline">{position.type}</Badge>
              </div>
              <div className="text-right">
                <div className="font-medium">${position.value.toLocaleString()}</div>
                <div className={`text-sm ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {position.unrealizedPnLPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
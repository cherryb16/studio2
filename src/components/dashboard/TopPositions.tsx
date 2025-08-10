'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopPositions } from '@/hooks/use-firestore-portfolio';

export default function TopPositions() {
  const { positions, loading, error } = useTopPositions(10);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Positions</CardTitle>
          <CardDescription>Your largest holdings by market value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Positions</CardTitle>
          <CardDescription>Error loading positions: {error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Positions</CardTitle>
        <CardDescription>Your largest holdings by market value</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {positions.map((position, index) => (
            <div key={position.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-medium">{position.symbol}</div>
                <Badge variant="outline">{position.instrumentType}</Badge>
              </div>
              <div className="text-right">
                <div className="font-medium">${position.marketValue.toLocaleString()}</div>
                <div className={`text-sm ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {position.unrealizedPnLPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
          {positions.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No positions found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
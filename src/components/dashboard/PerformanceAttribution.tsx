'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PerformanceAttribution({ performanceAttribution }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Attribution</CardTitle>
        <CardDescription>Top contributors and detractors</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Contributors */}
          <div>
            <h4 className="font-medium mb-3 text-green-600">Top Contributors</h4>
            <div className="space-y-2">
              {performanceAttribution.topContributors.slice(0, 3).map((position: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{position.symbol}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-green-600">
                      +${position.pnl.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({position.contribution.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Detractors */}
          <div>
            <h4 className="font-medium mb-3 text-red-600">Top Detractors</h4>
            <div className="space-y-2">
              {performanceAttribution.topDetractors?.slice(0, 3).map((position: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{position.symbol}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-red-600">
                      -${Math.abs(position.pnl).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({position.contribution.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
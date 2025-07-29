'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Building2 } from 'lucide-react';

export default function SectorAllocation({ sectorAnalysis }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sector Allocation</CardTitle>
        <CardDescription>Portfolio distribution across sectors</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sectorAnalysis.slice(0, 5).map((sector: any) => (
            <div key={sector.sector} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{sector.sector}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={sector.percentage} className="w-32" />
                <span className="text-sm font-medium w-12 text-right">
                  {sector.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
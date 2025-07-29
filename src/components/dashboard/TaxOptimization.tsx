'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TaxOptimization({ riskData }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Optimization</CardTitle>
        <CardDescription>Tax loss harvesting opportunities</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span>Unrealized Losses</span>
          <span className="font-medium text-red-600">
            ${riskData?.taxOptimization?.totalUnrealizedLosses?.toLocaleString() || '0'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Unrealized Gains</span>
          <span className="font-medium text-green-600">
            ${riskData?.taxOptimization?.totalUnrealizedGains?.toLocaleString() || '0'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Harvestable Amount</span>
          <span className="font-medium">
            ${riskData?.taxOptimization?.harvestableAmount?.toLocaleString() || '0'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Loss Opportunities</span>
          <Badge variant="secondary">
            {riskData?.taxOptimization?.taxLossOpportunities?.length || 0} positions
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
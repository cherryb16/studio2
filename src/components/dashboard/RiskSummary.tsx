'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function RiskSummary({ riskData }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Analysis</CardTitle>
        <CardDescription>Portfolio risk assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span>Overall Risk Score</span>
          <div className="flex items-center gap-2">
            <Progress value={(riskData?.riskSummary?.overallRiskScore || 0) * 10} className="w-24" />
            <span className="font-medium">{riskData?.riskSummary?.overallRiskScore}/10</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span>Diversification Score</span>
          <div className="flex items-center gap-2">
            <Progress value={(riskData?.riskSummary?.diversificationScore || 0) * 10} className="w-24" />
            <span className="font-medium">{riskData?.riskSummary?.diversificationScore}/10</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span>Concentration Risk</span>
          <Badge variant={riskData?.riskSummary?.concentrationRisk?.violations?.length! > 0 ? 'destructive' : 'secondary'}>
            {riskData?.riskSummary?.concentrationRisk?.violations?.length || 0} violations
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span>Correlation Risk</span>
          <Badge variant={
            riskData?.riskSummary?.correlationRisk?.level === 'high'
              ? 'destructive'
              : riskData?.riskSummary?.correlationRisk?.level === 'medium'
              ? 'default'
              : 'secondary'
          }>
            {riskData?.riskSummary?.correlationRisk?.level || 'unknown'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
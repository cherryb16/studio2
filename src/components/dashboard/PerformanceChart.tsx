'use client';

import { AreaChart, XAxis, YAxis, CartesianGrid, Area } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PerformanceChartProps {
  className?: string;
  analyticsData?: {
    totalBalance?: number;
    // add any additional fields you plan to use
  };
}

export default function PerformanceChart({
  className,
  analyticsData,
}: PerformanceChartProps) {
  const chartData = analyticsData
    ? [
        { month: 'Jan', portfolio: analyticsData.totalBalance || 0 },
        // You can expand this array dynamically based on real data
      ]
    : [];

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Performance Overview</CardTitle>
        <CardDescription>Your portfolio value over time</CardDescription>
      </CardHeader>
      <CardContent>
        <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" />
          <YAxis />
          <Area dataKey="portfolio" stroke="#8884d8" fill="#8884d8" />
        </AreaChart>
      </CardContent>
    </Card>
  );
}
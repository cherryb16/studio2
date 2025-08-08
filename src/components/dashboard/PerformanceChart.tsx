'use client';

import { AreaChart, XAxis, YAxis, CartesianGrid, Area, ResponsiveContainer, Tooltip } from 'recharts';
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
  performanceData?: {
    historicalData?: Array<{
      month: string;
      portfolio: number;
      date: string;
    }>;
    totalValue?: number;
  };
}

export default function PerformanceChart({
  className,
  performanceData,
}: PerformanceChartProps) {
  const chartData = performanceData?.historicalData || [];

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Performance Overview</CardTitle>
        <CardDescription>Your portfolio value over time</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                />
                <Tooltip 
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Portfolio Value']}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="portfolio" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No historical data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
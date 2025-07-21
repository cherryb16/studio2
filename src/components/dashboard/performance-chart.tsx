'use client';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartData = [
  { month: 'January', portfolio: 10000 },
  { month: 'February', portfolio: 10500 },
  { month: 'March', portfolio: 11200 },
  { month: 'April', portfolio: 11000 },
  { month: 'May', portfolio: 11800 },
  { month: 'June', portfolio: 12500 },
];

const chartConfig = {
  portfolio: {
    label: 'Portfolio Value',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

export function PerformanceChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='font-headline'>Performance Overview</CardTitle>
        <CardDescription>Your portfolio value over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${Number(value) / 1000}k`}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <defs>
                <linearGradient id="fillPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.1}/>
                </linearGradient>
            </defs>
            <Area
              dataKey="portfolio"
              type="natural"
              fill="url(#fillPortfolio)"
              stroke="hsl(var(--accent))"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

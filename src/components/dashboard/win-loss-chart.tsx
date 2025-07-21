'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Label, Pie, PieChart, Sector } from 'recharts';
import { PieSectorDataItem } from 'recharts/types/polar/Pie';

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
  { trade: 'wins', count: 80, fill: 'hsl(var(--accent))' },
  { trade: 'losses', count: 48, fill: 'hsl(var(--destructive))' },
];

const chartConfig = {
  count: {
    label: 'Trades',
  },
  wins: {
    label: 'Wins',
    color: 'hsl(var(--accent))',
  },
  losses: {
    label: 'Losses',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

export function WinLossChart() {
  const totalTrades = chartData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle className='font-headline'>Win/Loss Ratio</CardTitle>
        <CardDescription>A breakdown of your winning and losing trades</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="trade"
              innerRadius={60}
              strokeWidth={5}
              activeShape={({ outerRadius = 0, ...props }: PieSectorDataItem) => (
                <g>
                  <Sector {...props} outerRadius={outerRadius + 5} />
                  <Sector {...props} outerRadius={outerRadius + 15} innerRadius={outerRadius + 7} />
                </g>
              )}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {totalTrades.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Total Trades
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
       <div className="p-4 flex items-start gap-4 text-sm">
          <div className="flex items-center gap-2 font-medium leading-none">
            <TrendingUp className="h-4 w-4 text-accent" /> Wins:
            <span className="font-bold text-foreground">
              {chartData.find(d => d.trade === 'wins')?.count}
            </span>
          </div>
          <div className="flex items-center gap-2 font-medium leading-none">
            <TrendingDown className="h-4 w-4 text-destructive" /> Losses:
             <span className="font-bold text-foreground">
              {chartData.find(d => d.trade === 'losses')?.count}
            </span>
          </div>
        </div>
    </Card>
  );
}

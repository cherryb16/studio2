import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

type MetricCardProps = {
    title: string;
    value: string;
    icon: LucideIcon;
    trend?: 'up' | 'down';
};

export function MetricCard({ title, value, icon: Icon, trend }: MetricCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {trend && (
                    <p className={cn(
                        "text-xs text-muted-foreground flex items-center",
                        trend === 'up' ? 'text-green-600' : 'text-red-600'
                    )}>
                        {trend === 'up' ? 
                            <ArrowUpRight className="h-4 w-4 mr-1" /> : 
                            <ArrowDownRight className="h-4 w-4 mr-1" />
                        }
                        vs last month
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

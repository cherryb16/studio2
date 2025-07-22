'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import { getSnapTradeLoginUrl } from '@/app/actions/snaptrade';
import { useToast } from '@/hooks/use-toast';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { WinLossChart } from '@/components/dashboard/win-loss-chart'; // Corrected import
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, LineChart, ArrowUp, DollarSign, BarChart2 } from 'lucide-react'; // Added icon imports

export default function DashboardPage() {
    const { user } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);
    const { toast } = useToast();

    const handleConnectBrokerage = async () => {
        if (!user) return;
        setIsConnecting(true);
        try {
            const result = await getSnapTradeLoginUrl(user.uid);
            if (result.data?.redirectUrl) {
                window.location.href = result.data.redirectUrl;
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Connection Failed',
                    description: result.error || 'Could not get brokerage connection link.',
                });
            }
        } catch (e) {
             toast({
                variant: 'destructive',
                title: 'Connection Error',
                description: 'An unexpected error occurred.',
            });
        } finally {
            setIsConnecting(false);
        }
    }

    return (
        <ScrollArea className="h-full">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <div className="flex items-center space-x-2">
                         <Button
                            onClick={handleConnectBrokerage}
                            disabled={isConnecting}
                         >
                            {isConnecting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Connect Brokerage
                         </Button>
                    </div>
                </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard title="Total Trades" value="150" icon={LineChart} />{/* Added icon prop */}
                    <MetricCard title="Win Rate" value="65%" icon={ArrowUp} />{/* Added icon prop */}
                    <MetricCard title="Total P&L" value="$12,345" icon={DollarSign} />{/* Added icon prop */}
                    <MetricCard title="Avg. P&L per Trade" value="$82.30" icon={BarChart2} />{/* Added icon prop */}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <PerformanceChart className="col-span-4" />
                    <WinLossChart className="col-span-3" />
                </div> {/* Added closing div tag */}
            </div>
        </ScrollArea>
    );
}

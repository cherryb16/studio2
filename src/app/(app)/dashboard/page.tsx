'use client';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { WinLossChart } from '@/components/dashboard/win-loss-chart';
import { useAuth } from '@/hooks/use-auth';
import { getSnapTradeLoginUrl } from '@/app/actions/snaptrade';
import { useToast } from '@/hooks/use-toast';
import { Banknote, Percent, Scalpel, TrendingUp, TrendingDown, HelpCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function DashboardPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnectBrokerage = async () => {
        if (!user) return;
        setIsConnecting(true);
        try {
            const result = await getSnapTradeLoginUrl(user.uid);
            if (result.url) {
                window.location.href = result.url;
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Welcome Back, {user?.displayName?.split(' ')[0] || 'Trader'}!</h1>
          <p className="text-muted-foreground">Here&apos;s a snapshot of your trading performance.</p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard title="Total P/L" value="$7,845.12" icon={Banknote} trend="up" />
            <MetricCard title="Win Rate" value="62.5%" icon={Percent} trend="up" />
            <MetricCard title="Total Trades" value="128" icon={Scalpel} />
            <MetricCard title="Avg. Win" value="$250.78" icon={TrendingUp} />
            <MetricCard title="Avg. Loss" value="-$110.21" icon={TrendingDown} />
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-3">
                <PerformanceChart />
            </div>
            <div className="lg:col-span-2">
                <WinLossChart />
            </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="text-lg font-semibold font-headline flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-accent" />
                    Connect Your Brokerage
                </h3>
                <p className="text-muted-foreground text-sm mt-1">Automatically sync your trades by connecting your brokerage account.</p>
            </div>
            <Button onClick={handleConnectBrokerage} disabled={isConnecting}>
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect with SnapTrade
            </Button>
        </div>

      </div>
    );
}

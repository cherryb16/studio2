'use client';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { WinLossChart } from '@/components/dashboard/win-loss-chart';
import { useAuth } from '@/hooks/use-auth';
import { getSnapTradeLoginUrl } from '@/app/actions/snaptrade';
import { useToast } from '@/hooks/use-toast';
import { Banknote, Percent, TrendingUp, TrendingDown, HelpCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { UserData } from '@/lib/types';

const db = getFirestore();

export default function DashboardPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isConnecting, setIsConnecting] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);

    useEffect(() => {
        let unsubscribe: () => void;
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            unsubscribe = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUserData(docSnap.data() as UserData);
                } else {
                    setUserData(null);
                }
            });
        } else {
             setUserData(null);
        }
        return () => { if(unsubscribe) unsubscribe(); };
    }, [user]);

    const handleConnectSnapTrade = async () => {
        setIsConnecting(true);
        try {
            const result = await getSnapTradeLoginUrl(user!.uid);
             if (result.url) {
                window.location.href = result.url;
            } else if (result.error) {
                 toast({
                    variant: 'destructive',
                    title: 'Failed to connect to SnapTrade',
                    description: result.error,
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to connect to SnapTrade',
                description: error.message,
            });
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Profit/Loss"
                    value="$1,234.56"
                    trend="up"
                    icon={TrendingUp}
                />
                <MetricCard
                    title="Win Rate"
                    value="65%"
                    trend="up"
                    icon={Percent}
                />
                <MetricCard
                    title="Total Trades"
                    value="123"
                    trend="down"
                    icon={Banknote}
                />
                 <MetricCard
                    title="Average P/L per Trade"
                    value="$10.04"
                    trend="up"
                    icon={TrendingUp}
                />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <PerformanceChart className="col-span-4" />
                <WinLossChart className="col-span-3" />
            </div>
             {userData && !userData.snaptradeUserID && (
                <div className="flex justify-center">
                    <Button onClick={handleConnectSnapTrade} disabled={isConnecting}>
                         {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HelpCircle className="mr-2 h-4 w-4" />}
                        Connect to SnapTrade
                    </Button>
                </div>
            )}
        </div>
    );
}

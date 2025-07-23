// src/app/(app)/dashboard/page.tsx
'use client';

import { promises as fs } from 'fs';
import Head from 'next/head';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, PlusCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
// Import types from snaptrade-typescript-sdk
import { Account, Balance, Position, AccountUniversalActivity } from "snaptrade-typescript-sdk";

// Import action functions
import { getSnapTradeAccounts, getSnapTradeBalances, getAllPositions, getSnapTradePositions } from '@/app/actions/snaptrade'; // Assuming these are the correct action names


// Define a union type for action return types to include potential errors
type ActionReturnType<T> = T | { error: string };


const DashboardPage = () => {
    const { user, loading: authLoading } = useAuth();
    const firebaseUserId = user?.uid;

    const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);

    // Fetch Snaptrade credentials using firebaseUserId
    const { data: snaptradeCredentials, isLoading: credentialsLoading, error: credentialsError } = useQuery<{ snaptradeUserId: string; userSecret: string }>({
        queryKey: ['snaptradeCredentials', firebaseUserId],
        queryFn: async () => {
            if (!firebaseUserId) return Promise.reject('Firebase User ID not available');
            const response = await fetch(`/api/snaptrade-credentials?firebaseUserId=${firebaseUserId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch SnapTrade credentials');
            }
            return response.json();
        },
        enabled: !!firebaseUserId, // Only fetch when firebaseUserId is available
    });

    const snaptradeUserId = snaptradeCredentials?.snaptradeUserId;
    const userSecret = snaptradeCredentials?.userSecret;
    const credentialsAvailable = !!snaptradeUserId && !!userSecret;


    // Use ActionReturnType for the data type
    const { data: accounts, isLoading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useQuery<ActionReturnType<Account[]>>({
        queryKey: ['snaptradeAccounts', snaptradeUserId, userSecret],
        queryFn: () => getSnapTradeAccounts(firebaseUserId!, snaptradeUserId!, userSecret!),
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

     // Use ActionReturnType for the data type
    const { data: balances, isLoading: balancesLoading, error: balancesError, refetch: refetchBalances } = useQuery<ActionReturnType<Balance[]>>({
        queryKey: ['snaptradeBalances', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => getSnapTradeBalances(snaptradeUserId!, userSecret!, selectedAccount),
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

     // Use ActionReturnType for the data type (adjusting for the expected return of getAllPositions)
     // Assuming getAllPositions returns Position[] or { error: any }
     const { data: allPositions, isLoading: positionsLoading, error: positionsError, refetch: refetchPositions } = useQuery<ActionReturnType<Position[]>>({
        queryKey: ['snaptradePositions', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => getAllPositions(snaptradeUserId!, userSecret!, selectedAccount),
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

    // Assuming you have a function to fetch activities (trades) in your actions file
    // Replace 'getSnapTradeActivities' with the actual function name if different
     // Use ActionReturnType for the data type
    const { data: activities, isLoading: activitiesLoading, error: activitiesError, refetch: refetchActivities } = useQuery<ActionReturnType<AccountUniversalActivity[]>>({
        queryKey: ['snaptradeActivities', snaptradeUserId, userSecret, selectedAccount],
        queryFn: async () => {
             // You might need a specific action to get activities or use getAccountActivities from SDK in an action
             // For now, returning an empty array as a placeholder. Replace with actual fetching logic using your actions
             return [];
        },
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

    const isLoading = authLoading || credentialsLoading || accountsLoading || balancesLoading || positionsLoading || activitiesLoading;
    const dataError = credentialsError || (accounts as any)?.error || (balances as any)?.error || (allPositions as any)?.error || (activities as any)?.error;


    const handleRefresh = () => {
        refetchAccounts();
        refetchBalances();
        refetchPositions();
        refetchActivities();
    };

     // Safely access data and handle potential error objects
    const accountData = accounts && !('error' in accounts) ? accounts : [];
    const balanceData = balances && !('error' in balances) ? balances : [];
    const positionData = allPositions && !('error' in allPositions) ? allPositions : [];
    const activityData = activities && !('error' in activities) ? activities : [];

    // Calculate total balance from balances data, handling potential null/undefined cash
    const totalAccountBalance = Array.isArray(balanceData) ? balanceData.reduce((sum, balance) => sum + (balance.cash || 0), 0) : 0;

    // Calculate total market value from allPositions data
    // Note: The structure of position data might differ based on your action's return type
    const totalMarketValue = Array.isArray(positionData) ? positionData.reduce((sum, position) => sum + (position.market_value || 0), 0) : 0;

    // Filter open positions
     // Note: The structure of position data might differ based on your action's return type
     // Assuming position.symbol?.symbol?.type?.code === 'cs' for equities and position.symbol?.option_symbol for options
    const openEquities = Array.isArray(positionData) ? positionData.filter(position => position.symbol?.symbol?.type?.code === 'cs' && position.units !== 0) : [];
    const openOptions = Array.isArray(positionData) ? positionData.filter(position => position.symbol?.option_symbol && position.units !== 0) : [];

    // Calculate total unrealized profit/loss
     // Note: The structure of position data might differ based on your action's return type
    const totalUnrealizedPL = Array.isArray(positionData) ? positionData.reduce((sum, position) => sum + (position.unrealized_profit_loss || 0), 0) : 0;

    // Calculate win rate from activities data
    // Note: You will need to implement the logic to determine winning trades from the activity data
    const trades = Array.isArray(activityData) ? activityData.filter(activity => activity.type === 'TRADE') : []; // Assuming 'TRADE' is the type for trades
    const totalTrades = trades.length;
     // You'll need to determine how to identify winning trades from the activity data
    const winningTrades = 0; // Placeholder - requires logic to determine winning trades from activities
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Show loading state while authenticating or fetching credentials
    if (authLoading || credentialsLoading) {
        return <div>Loading...</div>;
    }

    // Show error if authentication fails or credentials fetching fails
    if (!user || credentialsError) {
        return <div className="text-red-500">Error loading user data or SnapTrade credentials. Please try again.</div>;
    }

    return (
        <ScrollArea className="h-full">
            <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <div className="flex items-center space-x-2">
                        <select
                            value={selectedAccount || 'all'}
                            onChange={(e) => setSelectedAccount(e.target.value === 'all' ? undefined : e.target.value)}
                            className="p-2 border rounded-md"
                            disabled={accountsLoading || !!accountsError} // Disable while loading accounts or if there's an account error
                        >
                            {/* Safely map over accountData */}
                            <option value="all">All Accounts</option>
                            {accountData && Array.isArray(accountData) && accountData.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name} ({account.institution_name})
                                </option>
                            ))}
                        </select>
                        <Button onClick={handleRefresh} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {dataError && (
                    <div className="text-red-500">Error loading data. Please try again.</div>
                )}

                {!dataError && (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Total Account Balance
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${totalAccountBalance.toFixed(2)}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Total Market Value
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${totalMarketValue.toFixed(2)}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{winRate.toFixed(2)}%</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Unrealized P/L
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-2xl font-bold ${totalUnrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ${totalUnrealizedPL.toFixed(2)}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle>Overview</CardTitle>
                                </CardHeader>
                                <CardContent className="pl-2">
                                    {/* Chart Placeholder */}
                                    <div className="h-[300px] w-full bg-gray-200 flex items-center justify-center rounded-md">
                                        Chart will be here
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="col-span-3">
                                <CardHeader>
                                    <CardTitle>Open Positions</CardTitle>
                                    <CardDescription>
                                        You have {openEquities.length} equity and {openOptions.length} option positions open.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {/* Open Positions List Placeholder */}
                                    <div className="h-[300px] w-full bg-gray-200 flex items-center justify-center rounded-md">
                                        Open Positions list will be here
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Trades</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {/* Recent Trades Table Placeholder */}
                                <div className="h-[300px] w-full bg-gray-200 flex items-center justify-center rounded-md">
                                    Recent Trades table will be here
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </ScrollArea>
    );
};

export default DashboardPage;

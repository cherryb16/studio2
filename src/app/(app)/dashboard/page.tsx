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
            const response = await fetch(`/api/firebase/getCredentials?firebaseUserId=${firebaseUserId}`);
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


    // Fetch accounts (always fetch all to populate the dropdown)
    const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery<ActionReturnType<Account[]>>({
        queryKey: ['snaptradeAccounts', snaptradeUserId, userSecret],
        queryFn: () => getSnapTradeAccounts(snaptradeUserId!, userSecret!),
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

     // Fetch balances based on selected account (this is for balances per currency)
    const { data: balances, isLoading: balancesLoading, error: balancesError } = useQuery<ActionReturnType<Balance[]>>({
        queryKey: ['snaptradeBalances', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => getSnapTradeBalances(snaptradeUserId!, userSecret!),
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

     // Fetch positions based on selected account
     const { data: allPositions, isLoading: positionsLoading, error: positionsError } = useQuery<ActionReturnType<Position[]>>({
        queryKey: ['snaptradePositions', snaptradeUserId, userSecret, selectedAccount],
        queryFn: async (): Promise<ActionReturnType<Position[]>> => {
            const result = await getAllPositions(snaptradeUserId!, userSecret!);
            if (Array.isArray(result)) return result;
            if (result && typeof result === "object" && "error" in result) return result as { error: string };
            return { error: "Unexpected response format from getAllPositions" };
        },
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

    // Fetch activities based on selected account
    const { data: activities, isLoading: activitiesLoading, error: activitiesError } = useQuery<ActionReturnType<AccountUniversalActivity[]>>({
        queryKey: ['snaptradeActivities', snaptradeUserId, userSecret, selectedAccount],
        queryFn: async () => {
             // You might need a specific action to get activities based on accountId
             // For now, returning an empty array as a placeholder. Replace with actual fetching logic using your actions
             return [];
        },
        enabled: credentialsAvailable, // Only fetch when credentials are available
    });

    const isLoading = authLoading || credentialsLoading || accountsLoading || balancesLoading || positionsLoading || activitiesLoading;
    const dataError = credentialsError || (accounts as any)?.error || (balances as any)?.error || (allPositions as any)?.error || (activities as any)?.error;


     // Safely access data and handle potential error objects
    const accountData = accounts && !('error' in accounts) ? accounts : [];
    const balanceData = balances && !('error' in balances) ? balances : [];
    const positionData: Position[] = Array.isArray(allPositions) ? allPositions : [];
    const activityData = activities && !('error' in activities) ? activities : [];

    // Calculate total balance based on selected account
    const totalAccountBalance = selectedAccount
        ? (accountData as Account[]).find(account => account.id === selectedAccount)?.balance?.total?.amount || 0
        : Array.isArray(accountData) ? accountData.reduce((sum, account) => sum + (account.balance?.total?.amount || 0), 0) : 0;

    // Filter and calculate total market value for equities
    const openEquities: Position[] = Array.isArray(positionData) ? positionData.filter(position => position.symbol?.symbol?.type?.code === 'cs' && position.units !== 0) : [];
    const totalEquitiesValue = Array.isArray(openEquities) ? openEquities.reduce((sum, position) => {
        console.log("Processing Equity Position for Market Value:", position, "Current Sum:", sum);
        return sum + ((position.price || 0) * (position.units || 0)); // Calculate using price * units
    }, 0) : 0;

    // Filter and calculate total market value for options
    const openOptions: Position[] = Array.isArray(positionData) ? positionData.filter(position => position.symbol?.option_symbol && position.units !== 0) : [];
    const totalOptionsValue = Array.isArray(openOptions) ? openOptions.reduce((sum, position) => {
         console.log("Processing Option Position for Market Value:", position, "Current Sum:", sum);
        return sum + ((position.price || 0) * (position.units || 0) * 100); // Calculate using price * units * 100
    }, 0) : 0;


    // Calculate total unrealized equities P/L
    console.log("Open Equities for Unrealized P/L:", openEquities); // Log openEquities
    const totalUnrealizedEquitiesPL = Array.isArray(openEquities) ? openEquities.reduce((sum, position) => {
        console.log("Processing Equity Position for Unrealized P/L:", position, "Unrealized P/L (open_pnl):", position.open_pnl, "Current Sum:", sum); // Log each equity position and its open_pnl
        return sum + (position.open_pnl || 0);
    }, 0) : 0;
    console.log("Total Unrealized Equities P/L:", totalUnrealizedEquitiesPL); // Log final total unrealized equities P/L

    // Calculate total unrealized options P/L
    const totalUnrealizedOptionsPL = Array.isArray(openOptions) ? openOptions.reduce((sum, position) => {
        console.log("Processing Option Position for Unrealized P/L:", position, "Current Sum:", sum); // Log each option position
        const calculatedValue = (position.price || 0) * (position.units || 0) * 100;
        const averageCost = (position.average_purchase_price || 0) * (position.units || 0) * 100; // Multiply by units and 100
        const pnl = calculatedValue - averageCost;
        console.log("Processing Option Position for Unrealized P/L:", position, "Calculated P/L:", pnl, "Current Sum:", sum); // Log calculated P/L for options
        return sum + pnl;
    }, 0) : 0;
    console.log("Total Unrealized Options P/L:", totalUnrealizedOptionsPL); // Log final total unrealized options P/L

    // Calculate win rate from activities data (which will be for the selected account or all)
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
                            title="Select Account"
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
                                    <div className="text-2xl font-bold">${totalAccountBalance.toLocaleString()}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Total Equities Value
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${totalEquitiesValue.toLocaleString()}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Options Value</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${totalOptionsValue.toLocaleString()}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Unrealized Equities P/L
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-2xl font-bold ${totalUnrealizedEquitiesPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {totalUnrealizedEquitiesPL < 0 ? '-' : ''}${Math.abs(totalUnrealizedEquitiesPL).toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
                             <Card className="col-span-4">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Unrealized Options P/L
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                     <div className={`text-2xl font-bold ${totalUnrealizedOptionsPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {totalUnrealizedOptionsPL < 0 ? '-' : ''}${Math.abs(totalUnrealizedOptionsPL).toLocaleString()}
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

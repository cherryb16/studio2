// src/app/(app)/dashboard/page.tsx
"use client"
import { DollarSign, LineChart, BarChart2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MetricCard } from "@/components/dashboard/metric-card"; // Corrected import
// import PerformanceChart from "@/components/dashboard/performance-chart"; // PerformanceChart removed
import { WinLossChart } from "@/components/dashboard/win-loss-chart"; // Corrected import
import { useQuery } from "@tanstack/react-query";
import { getSnapTradeAccounts, getSnapTradeBalances, getOpenEquities, getOpenOptions, getCash, getAllPositions } from "@/app/actions/snaptrade"; // Import getAllPositions
import { useState, useEffect } from "react"; // Import useEffect
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth"; // Assuming you have a useAuth hook
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"; // Import table components


export default function DashboardPage() {
    const { user } = useAuth(); // Get the authenticated user
    const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
    const [snaptradeUserId, setSnaptradeUserId] = useState<string | null>(null);
    const [userSecret, setUserSecret] = useState<string | null>(null);


    // Fetch SnapTrade credentials from Firestore
    useEffect(() => {
        const fetchCredentials = async () => {
            if (user?.uid) {
                // Assuming getSnapTradeCredentials is available in your snaptrade.ts actions
                const credentials = await fetch('/api/snaptrade-credentials?firebaseUserId=' + user.uid).then(res => res.json()); // You'll need an API endpoint for this
                if (credentials?.snaptradeUserId && credentials?.userSecret) {
                    setSnaptradeUserId(credentials.snaptradeUserId);
                    setUserSecret(credentials.userSecret);
                } else {
                    console.error("Failed to fetch SnapTrade credentials.");
                    // Handle the case where credentials are not found
                }
            }
        };
        fetchCredentials();
    }, [user?.uid]);


    // Fetch accounts
    const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery({
        queryKey: ['snaptradeAccounts', snaptradeUserId, userSecret],
        queryFn: () => {
            if (snaptradeUserId && userSecret && user?.uid) {
                return getSnapTradeAccounts(user.uid, snaptradeUserId, userSecret);
            }
            return Promise.resolve([]); // Return an empty array if credentials are not available yet
        },
        enabled: !!snaptradeUserId && !!userSecret && !!user?.uid, // Only fetch if credentials are available
    });

    // Fetch balances
    const { data: balances, error: balanceError, isLoading: balanceLoading, refetch: refetchBalances } = useQuery({
        queryKey: ['accountBalances', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => {
            if (snaptradeUserId && userSecret) {
                return getSnapTradeBalances(snaptradeUserId, userSecret, selectedAccount);
            }
            return Promise.resolve([]);
        },
        enabled: !!snaptradeUserId && !!userSecret,
    });

    // Fetch open equities
    const { data: openEquities, error: equitiesError, isLoading: equitiesLoading, refetch: refetchOpenEquities } = useQuery({
        queryKey: ['openEquities', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => {
            if (snaptradeUserId && userSecret) {
                 // Pass selectedAccount to filter equities by account
                return getOpenEquities(snaptradeUserId, userSecret, selectedAccount);
            }
            return Promise.resolve(0);
        },
        enabled: !!snaptradeUserId && !!userSecret,
    });

    // Fetch open options
    const { data: openOptions, error: optionsError, isLoading: optionsLoading, refetch: refetchOpenOptions } = useQuery({
        queryKey: ['openOptions', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => {
             if (snaptradeUserId && userSecret) {
                 // Pass selectedAccount to filter options by account
                return getOpenOptions(snaptradeUserId, userSecret, selectedAccount);
            }
            return Promise.resolve(0);
        },
         enabled: !!snaptradeUserId && !!userSecret,
    });

    // Fetch cash
    const { data: cash, error: cashError, isLoading: cashLoading, refetch: refetchCash } = useQuery({
        queryKey: ['cash', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => {
             if (snaptradeUserId && userSecret) {
                 // Pass selectedAccount to filter cash by account
                return getCash(snaptradeUserId, userSecret, selectedAccount);
            }
             return Promise.resolve(0);
        },
         enabled: !!snaptradeUserId && !!userSecret,
    });

     // Fetch all positions (for the table)
     const { data: allPositions, error: allPositionsError, isLoading: allPositionsLoading, refetch: refetchAllPositions } = useQuery({
        queryKey: ['allPositions', snaptradeUserId, userSecret, selectedAccount],
        queryFn: () => {
             if (snaptradeUserId && userSecret) {
                return getAllPositions(snaptradeUserId, userSecret, selectedAccount); // Pass selectedAccount
             }
             return Promise.resolve([]);
        },
         enabled: !!snaptradeUserId && !!userSecret,
    });


    const isLoading = accountsLoading || balanceLoading || equitiesLoading || optionsLoading || cashLoading || allPositionsLoading;
    const dataError = accountsError || balanceError || equitiesError || optionsError || cashError || allPositionsError;

    const handleRefresh = () => {
        refetchBalances();
        refetchOpenEquities();
        refetchOpenOptions();
        refetchCash();
        refetchAllPositions(); // Refetch all positions as well
    };

     // Calculate total balance from balances data, handling potential null/undefined cash
    const totalAccountBalance = Array.isArray(balances) ? balances.reduce((sum, balance) => sum + (balance.cash || 0), 0) : 0;


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
                            <option value="all">All Accounts</option>
                            {accounts && Array.isArray(accounts) && accounts.map((account: any) => (
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
                {isLoading ? (
                    <div>Loading...</div>
                ) : dataError ? (
                    <div>Error: {dataError instanceof Error ? dataError.message : 'An unknown error occurred'}</div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <MetricCard title="Total Account Balance" value={`$${totalAccountBalance.toFixed(2)}`} icon={DollarSign} />
                            {/* Added checks for undefined before calling toString() */}
                            <MetricCard title="Open Equities" value={openEquities !== undefined && openEquities !== null ? openEquities.toString() : 'N/A'} icon={LineChart} />
                            <MetricCard title="Open Options" value={openOptions !== undefined && openOptions !== null ? openOptions.toString() : 'N/A'} icon={BarChart2} />
                            {/* Calculate cash by summing up cash from all balances, handling potential null/undefined */}
                            <MetricCard title="Cash" value={`$${(Array.isArray(balances) ? balances.reduce((sum, balance) => sum + (balance.cash || 0), 0) : 0).toFixed(2)}`} icon={DollarSign} />
                        </div>
                        {/* Display All Positions in a table */}
                        {allPositions && Array.isArray(allPositions) && allPositions.length > 0 && (
                             <div className="space-y-4">
                                <h3 className="text-2xl font-bold tracking-tight">All Positions</h3>
                                <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Symbol</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Units</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Average Purchase Price</TableHead>
                                            <TableHead>Open PnL</TableHead>
                                            <TableHead>Account</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {console.log("allPositions before filter:", allPositions)}
                                        {allPositions
                                            .filter(position => {
                                                console.log("Filtering position:", position, "Is Array and empty:", Array.isArray(position) && position.length === 0);
                                                return !(Array.isArray(position) && position.length === 0);
                                            })
                                            .map((position: any, index: number) => {
                                                let symbolString = 'N/A'; // Initialize with a default string

                                                if (position.symbol) {
                                                    if (position.symbol.symbol) {
                                                        symbolString = position.symbol.symbol;
                                                    } else if (position.symbol.option_symbol?.ticker) {
                                                        symbolString = position.symbol.option_symbol.ticker;
                                                    }
                                                }

                                                console.log("position.symbol (detailed):", JSON.stringify(position.symbol, null, 2)); // Detailed log

                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell>{symbolString}</TableCell>
                                                        <TableCell>{position.symbol?.description || 'N/A'}</TableCell>
                                                        <TableCell>{String(position.units) || 'N/A'}</TableCell>
                                                        <TableCell>{String(position.price) || 'N/A'}</TableCell>
                                                        <TableCell>{String(position.average_purchase_price) || 'N/A'}</TableCell>
                                                        <TableCell>{String(position.open_pnl) || 'N/A'}</TableCell>
                                                        {/* Find the account name for the position */}
                                                        <TableCell>
                                                            {accounts && Array.isArray(accounts)
                                                                ? accounts.find((acc: any) => acc.id === position.account_id)?.name || 'N/A'
                                                                : 'N/A'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                    </TableBody>
                                </Table>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <WinLossChart className="col-span-3" />
                        </div>
                    </>
                )}
            </div>
        </ScrollArea>
    );
}
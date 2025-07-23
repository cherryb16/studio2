'use client';

import { useSnapTradePositions } from '../../../hooks/useSnapTrade';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Position {
    symbol: { symbol: string; option_symbol?: string };
    price: number;
    market_value: number;
    units: number;
    average_purchase_price: number;
    realized_pnl: number;
    open_pnl: number;
}

const PositionsPage = () => {
    const { data: positions, isLoading, error } = useSnapTradePositions();
    const [filter, setFilter] = useState('');
    const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'market_value' | 'units' | 'average_purchase_price' | 'realized_pnl' | 'open_pnl'>('symbol');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [grouping, setGrouping] = useState<'none' | 'type'>('none');

    const filteredAndSortedPositions = useMemo(() => {
        let filtered = positions || [];
        if (filter) {
            filtered = filtered.filter(position =>
                position.symbol?.symbol.toLowerCase().includes(filter.toLowerCase()) ||
                position.symbol?.option_symbol?.toLowerCase().includes(filter.toLowerCase())
            );
        }

        filtered.sort((a, b) => {
            const aValue = a[sortBy as keyof Position];
            const bValue = b[sortBy as keyof Position];

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        if (grouping === 'type') {
            const equities = filtered.filter(position => !position.symbol?.option_symbol);
            const options = filtered.filter(position => position.symbol?.option_symbol);
            return { equities, options };
        }

        return filtered;
    }, [positions, filter, sortBy, sortDirection, grouping]);

    if (isLoading) return <div>Loading...</div>;
    if (error) return <p>Error loading positions: {error.message}</p>;

    const renderTable = (data: Position[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead onClick={() => setSortBy('symbol')}>Symbol</TableHead>
                    <TableHead onClick={() => setSortBy('price')}>Price</TableHead>
                    <TableHead onClick={() => setSortBy('market_value')}>Value</TableHead>
                    <TableHead onClick={() => setSortBy('units')}>Quantity</TableHead>
                    <TableHead onClick={() => setSortBy('average_purchase_price')}>Purchase Price</TableHead>
                    <TableHead onClick={() => setSortBy('realized_pnl')}>Realized P/L</TableHead>
                    <TableHead onClick={() => setSortBy('open_pnl')}>Unrealized P/L</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((position, index) => (
                    <TableRow key={index}>
                        <TableCell>{position.symbol?.option_symbol || position.symbol?.symbol}</TableCell>
                        <TableCell>{position.price?.toFixed(2)}</TableCell>
                        <TableCell>{position.market_value?.toFixed(2)}</TableCell>
                        <TableCell>{position.units}</TableCell>
                        <TableCell>{position.average_purchase_price?.toFixed(2)}</TableCell>
                        <TableCell>{position.realized_pnl?.toFixed(2)}</TableCell>
                        <TableCell>{position.open_pnl?.toFixed(2)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Positions</h1>
            <div className="flex gap-4 mb-6">
                <div className="flex-1">
                    <Label htmlFor="filter">Filter by Symbol</Label>
                    <Input
                        id="filter"
                        type="text"
                        placeholder="Enter symbol..."
                        value={filter}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="grouping">Group By</Label>
                    <Select value={grouping} onValueChange={(value: "none" | "type") => setGrouping(value)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Group By" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="type">Type (Equity/Option)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="sortDirection">Sort Direction</Label>
                    <Select value={sortDirection} onValueChange={(value: "asc" | "desc") => setSortDirection(value)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort Direction" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {grouping === 'type' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Equities</CardTitle></CardHeader>
                        <CardContent>
                            {Array.isArray(filteredAndSortedPositions) ? (
                                renderTable(filteredAndSortedPositions.filter(position => !position.symbol?.option_symbol))
                            ) : (
                                renderTable(filteredAndSortedPositions.equities)
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Options</CardTitle></CardHeader>
                        <CardContent>
                             {Array.isArray(filteredAndSortedPositions) ? (
                                renderTable(filteredAndSortedPositions.filter(position => position.symbol?.option_symbol))
                            ) : (
                                renderTable(filteredAndSortedPositions.options)
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardHeader><CardTitle>All Positions</CardTitle></CardHeader>
                    <CardContent>
                        {Array.isArray(filteredAndSortedPositions) ? (
                            renderTable(filteredAndSortedPositions)
                        ) : (
                            <p>No positions available.</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default PositionsPage;
'use client';

import { useSnapTradePositions } from '../../../hooks/useSnapTrade';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Position {
    symbol: {
        symbol?: string; // Assuming equity symbol is directly here
        option_symbol?: {
            underlying_symbol?: { symbol?: string }; // Use underlying_symbol.symbol for ticker
            option_type?: string;
            strike_price?: number;
            expiration_date?: string; // Added expiration_date
            // ... other option_symbol properties
        };
        id?: string;
        description?: string;
        local_id?: string;
        security_type?: any; // You might want to define a proper interface for security_type
    } | null | undefined;
    price: number | null | undefined;
    market_value: number | null | undefined;
    units: number | null | undefined;
    average_purchase_price: number | null | undefined;
    realized_pnl: number | null | undefined;
    open_pnl: number | null | undefined;
    currency: { code: string; name: string; id: string } | null | undefined;
}

const PositionsPage = () => {
    const { data: positions, isLoading, error } = useSnapTradePositions();
    const [filter, setFilter] = useState('');
    const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'market_value' | 'units' | 'average_purchase_price' | 'realized_pnl' | 'open_pnl'>('symbol');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [grouping, setGrouping] = useState<'none' | 'type'>('none');

    // Defensive: always treat positions as array
    const safePositions: Position[] = Array.isArray(positions) ? positions : [];

    const filteredAndSortedPositions = useMemo(() => {
        let filtered = safePositions;
        if (filter) {
            filtered = filtered.filter(position => {
                const equitySymbol = position?.symbol?.symbol?.toLowerCase();
                const optionSymbol = position?.symbol?.option_symbol;
                const optionString = optionSymbol?.underlying_symbol?.symbol ?
                    `${optionSymbol.underlying_symbol.symbol} ${optionSymbol.strike_price || ''} ${optionSymbol.option_type || ''} ${optionSymbol.expiration_date || ''}`.toLowerCase() : '';
                return equitySymbol?.includes(filter.toLowerCase()) || optionString.includes(filter.toLowerCase());
            });
        }

        filtered.sort((a, b) => {
            const aValue = a && sortBy in a ? a[sortBy as keyof Position] : undefined;
            const bValue = b && sortBy in b ? b[sortBy as keyof Position] : undefined;
            if (aValue === undefined || aValue === null) return sortDirection === 'asc' ? 1 : -1;
            if (bValue === undefined || bValue === null) return sortDirection === 'asc' ? -1 : 1;
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        if (grouping === 'type') {
            const equities = filtered.filter(position => position?.symbol?.symbol);
            const options = filtered.filter(position => position?.symbol?.option_symbol);
            return { equities, options };
        }

        return filtered;
    }, [safePositions, filter, sortBy, sortDirection, grouping]);

    if (isLoading) return <div>Loading...</div>;
    if (error) return <p>Error loading positions: {error.message}</p>;
    if (!Array.isArray(positions) && grouping === 'none') return <p>Unexpected data format.</p>;

    const renderTable = (data: Position[] | undefined) => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return <p>No positions available.</p>;
        }
        return (
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
                        <TableHead>Expiration Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((position, index) => {
                        console.log(`Rendering position at index ${index}:`, position);
                        if (!position) {
                            return null;
                        }
    
                        // Determine the symbol to display, handling various cases
                        let symbolToDisplay = '-';
                        let expirationDateToDisplay = '-'; // Variable to hold expiration date
                        if (position.symbol) {
                             // Use underlying_symbol.symbol and include expiration_date for options
                             if (position.symbol.option_symbol?.underlying_symbol) { // Check if underlying_symbol exists
                                 const option = position.symbol.option_symbol;
                                const underlyingSymbol = option.underlying_symbol?.symbol || '-';
                                symbolToDisplay = `${underlyingSymbol} $${option.strike_price || '-'} ${option.option_type || '-'}`;                                 expirationDateToDisplay = option.expiration_date || '-'; // Get expiration date
                             } else if (position.symbol.symbol) { // Check for equity symbol here
                                 symbolToDisplay = position.symbol.symbol;
                             } else if (position.symbol.description) { // Fallback to description
                                 symbolToDisplay = position.symbol.description;
                             } else if (position.symbol.local_id) { // Fallback to local_id
                                 symbolToDisplay = position.symbol.local_id;
                             }
                         }
    
                        return (
                            <TableRow key={index}>
                                {/* Explicitly convert to string */}
                                <TableCell>{String(symbolToDisplay)}</TableCell>
                                <TableCell>{String(position.price?.toFixed(2) || '-')}</TableCell>
                                <TableCell>{String(position.market_value?.toFixed(2) || '-')}</TableCell>
                                <TableCell>{String(position.units || '-')}</TableCell>
                                <TableCell>{String(position.average_purchase_price?.toFixed(2) || '-')}</TableCell>
                                <TableCell>{String(position.realized_pnl?.toFixed(2) || '-')}</TableCell>
                                <TableCell>{String(position.open_pnl?.toFixed(2) || '-')}</TableCell>
                                <TableCell>{String(expirationDateToDisplay)}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
                </Table>
        );
    };   

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
                            {renderTable((filteredAndSortedPositions as { equities: Position[], options: Position[] }).equities)}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Options</CardTitle></CardHeader>
                        <CardContent>
                             {renderTable((filteredAndSortedPositions as { equities: Position[], options: Position[] }).options)}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardHeader><CardTitle>All Positions</CardTitle></CardHeader>
                    <CardContent>
                        {renderTable(filteredAndSortedPositions as Position[])}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default PositionsPage;
'use client';
import type { Trade } from '@/lib/types';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ArrowUpDown, PlusCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TradeForm } from './trade-form';
import { cn } from '@/lib/utils';

const initialTrades: Trade[] = [
    { id: '1', instrument: 'AAPL', date: '2023-10-26', entryPrice: 170.50, exitPrice: 175.20, position: 'long', pnl: 470, status: 'win' },
    { id: '2', instrument: 'TSLA', date: '2023-10-25', entryPrice: 220.10, exitPrice: 215.80, position: 'short', pnl: 430, status: 'win' },
    { id: '3', instrument: 'GOOGL', date: '2023-10-24', entryPrice: 135.00, exitPrice: 133.50, position: 'long', pnl: -150, status: 'loss' },
    { id: '4', instrument: 'MSFT', date: '2023-10-23', entryPrice: 330.00, exitPrice: 330.00, position: 'long', pnl: 0, status: 'breakeven' },
    { id: '5', instrument: 'NVDA', date: '2023-10-20', entryPrice: 430.80, exitPrice: 455.10, position: 'long', pnl: 2430, status: 'win' },
];

type SortKey = keyof Trade;
type SortDirection = 'asc' | 'desc';

export function TradesTable() {
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const sortedTrades = [...trades].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    const aValue = a[key];
    const bValue = b[key];

    if (aValue < bValue) {
      return direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const handleSave = (trade: Trade) => {
    if (editingTrade) {
      setTrades(trades.map(t => (t.id === trade.id ? trade : t)));
    } else {
      setTrades([...trades, { ...trade, id: (trades.length + 1).toString() }]);
    }
    setIsDialogOpen(false);
    setEditingTrade(null);
  };

  const handleDelete = (id: string) => {
    setTrades(trades.filter(t => t.id !== id));
  };
  
  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade);
    setIsDialogOpen(true);
  }
  
  const handleAdd = () => {
    setEditingTrade(null);
    setIsDialogOpen(true);
  }

  const columns: { key: SortKey; label: string; }[] = [
    { key: 'instrument', label: 'Instrument' },
    { key: 'date', label: 'Date' },
    { key: 'position', label: 'Position' },
    { key: 'entryPrice', label: 'Entry Price' },
    { key: 'exitPrice', label: 'Exit Price' },
    { key: 'pnl', label: 'P/L ($)' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <div className="w-full">
        <div className="flex justify-end mb-4">
            <Button onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Trade
            </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                    <TableHead key={col.key} onClick={() => requestSort(col.key)} className="cursor-pointer">
                        <div className="flex items-center">
                            {col.label}
                            {getSortIndicator(col.key)}
                        </div>
                    </TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTrades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium">{trade.instrument}</TableCell>
                  <TableCell>{trade.date}</TableCell>
                  <TableCell>
                     <Badge variant={trade.position === 'long' ? 'secondary' : 'default'} className={cn(
                        trade.position === 'long' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                     )}>
                        {trade.position}
                     </Badge>
                  </TableCell>
                  <TableCell>${trade.entryPrice.toFixed(2)}</TableCell>
                  <TableCell>${trade.exitPrice.toFixed(2)}</TableCell>
                  <TableCell className={cn(trade.pnl > 0 ? 'text-green-600' : trade.pnl < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                    {trade.pnl.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={trade.status === 'win' ? 'default' : trade.status === 'loss' ? 'destructive' : 'secondary'} className={cn(
                        trade.status === 'win' && 'bg-green-100 text-green-800',
                        trade.status === 'loss' && 'bg-red-100 text-red-800',
                        trade.status === 'breakeven' && 'bg-gray-100 text-gray-800'
                    )}>
                        {trade.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(trade)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(trade.id)} className="text-red-600">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingTrade ? 'Edit Trade' : 'Add New Trade'}</DialogTitle>
        </DialogHeader>
        <TradeForm onSave={handleSave} trade={editingTrade} />
      </DialogContent>
    </Dialog>
  );
}

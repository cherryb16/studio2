'use client';

import { useSnapTradePositions } from '../../../hooks/useSnapTrade';
import { useState, useMemo, useRef, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { DropTargetMonitor, DragSourceMonitor } from 'react-dnd/dist/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Position {
    symbol: {
        symbol?: string;
        option_symbol?: {
            underlying_symbol?: { symbol?: string };
            option_type?: string;
            strike_price?: number;
            expiration_date?: string;
        };
        id?: string;
        description?: string;
        local_id?: string;
        security_type?: any;
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
    // All hooks declared unconditionally and in the same order
    const { data: positions, isLoading, error } = useSnapTradePositions();
    const safePositions: Position[] = Array.isArray(positions) ? positions : [];
    const [filter, setFilter] = useState('');
    // Dynamic column management state and toggles (unconditionally declared)
    // Dropdown visibility states
    const [showOptionDropdown, setShowOptionDropdown] = useState(false);
    const [showEquityDropdown, setShowEquityDropdown] = useState(false);
    const [visibleEquityColumns, setVisibleEquityColumns] = useState<
      (
        'Symbol' |
        'Price' |
        'Value' |
        'Quantity' |
        'Purchase Price' |
        'Unrealized P/L'
      )[]
    >([
      'Symbol', 'Price', 'Value', 'Quantity', 'Purchase Price', 'Unrealized P/L',
    ]);

    const [visibleOptionColumns, setVisibleOptionColumns] = useState<
      (
        'Underlying' |
        'Strike' |
        'Type' |
        'Expiration' |
        'Quantity' |
        'Market Value' |
        'Unrealized P/L'
      )[]
    >([
      'Underlying', 'Strike', 'Type', 'Expiration', 'Quantity', 'Market Value', 'Unrealized P/L',
    ]);
    const { equities, options } = useMemo(() => {
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
        const equities = filtered.filter(position => position?.symbol?.symbol);
        const options = filtered.filter(position => position?.symbol?.option_symbol);
        return { equities, options };
    }, [safePositions, filter]);

    if (isLoading) return <div>Loading...</div>;
    if (error) return <p>Error loading positions: {error.message}</p>;
    if (!Array.isArray(positions)) return <p>Unexpected data format.</p>;

    const toggleEquityColumn = (col: typeof visibleEquityColumns[number]) => {
      setVisibleEquityColumns(prev =>
        prev.includes(col)
          ? prev.filter(c => c !== col)
          : [...prev, col as typeof visibleEquityColumns[number]]
      );
    };

    const toggleOptionColumn = (col: typeof visibleOptionColumns[number]) => {
      setVisibleOptionColumns(prev =>
        prev.includes(col)
          ? prev.filter(c => c !== col)
          : [...prev, col as typeof visibleOptionColumns[number]]
      );
    };

    // Table for equities
    const renderEquitiesTable = (data: Position[] | undefined) => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return <p>No equities available.</p>;
        }
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        {visibleEquityColumns.includes('Symbol') && <TableHead>Symbol</TableHead>}
                        {visibleEquityColumns.includes('Price') && <TableHead>Price</TableHead>}
                        {visibleEquityColumns.includes('Value') && <TableHead>Value</TableHead>}
                        {visibleEquityColumns.includes('Quantity') && <TableHead>Quantity</TableHead>}
                        {visibleEquityColumns.includes('Purchase Price') && <TableHead>Purchase Price</TableHead>}
                        {visibleEquityColumns.includes('Unrealized P/L') && <TableHead>Unrealized P/L</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((position, index) => {
                        if (!position) return null;
                        let rawSymbol: unknown = position.symbol?.symbol;
                        let symbolToDisplay =
                          typeof rawSymbol === 'string'
                            ? rawSymbol
                            : rawSymbol && typeof rawSymbol === 'object' && 'symbol' in rawSymbol && typeof rawSymbol.symbol === 'string'
                            ? rawSymbol.symbol
                            : position.symbol?.description || position.symbol?.local_id || '-';
                        return (
                            <TableRow key={index}>
                                {visibleEquityColumns.includes('Symbol') && (
                                  <TableCell>{String(symbolToDisplay)}</TableCell>
                                )}
                                {visibleEquityColumns.includes('Price') && (
                                  <TableCell>{typeof position.price === 'number' ? position.price.toFixed(2) : '-'}</TableCell>
                                )}
                                {visibleEquityColumns.includes('Value') && (
                                  <TableCell>{typeof position.market_value === 'number' ? position.market_value.toFixed(2) : '-'}</TableCell>
                                )}
                                {visibleEquityColumns.includes('Quantity') && (
                                  <TableCell>{String(position.units || '-')}</TableCell>
                                )}
                                {visibleEquityColumns.includes('Purchase Price') && (
                                  <TableCell>{typeof position.average_purchase_price === 'number' ? position.average_purchase_price.toFixed(2) : '-'}</TableCell>
                                )}
                                {visibleEquityColumns.includes('Unrealized P/L') && (
                                  <TableCell>{typeof position.open_pnl === 'number' ? position.open_pnl.toFixed(2) : '-'}</TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    };

    // Table for options
    const renderOptionsTable = (data: Position[] | undefined) => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return <p>No options available.</p>;
        }
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        {visibleOptionColumns.includes('Underlying') && <TableHead>Underlying</TableHead>}
                        {visibleOptionColumns.includes('Strike') && <TableHead>Strike</TableHead>}
                        {visibleOptionColumns.includes('Type') && <TableHead>Type</TableHead>}
                        {visibleOptionColumns.includes('Expiration') && <TableHead>Expiration</TableHead>}
                        {visibleOptionColumns.includes('Quantity') && <TableHead>Quantity</TableHead>}
                        {visibleOptionColumns.includes('Market Value') && <TableHead>Market Value</TableHead>}
                        {visibleOptionColumns.includes('Unrealized P/L') && <TableHead>Unrealized P/L</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((position, index) => {
                        if (!position) return null;
                        const option = position.symbol?.option_symbol;
                        const underlying = option?.underlying_symbol?.symbol || '-';
                        const strike = option?.strike_price !== undefined ? option.strike_price : '-';
                        const type = option?.option_type || '-';
                        const expiration = option?.expiration_date || '-';
                        return (
                            <TableRow key={index}>
                                {visibleOptionColumns.includes('Underlying') && (
                                  <TableCell>{String(underlying)}</TableCell>
                                )}
                                {visibleOptionColumns.includes('Strike') && (
                                  <TableCell>{String(strike)}</TableCell>
                                )}
                                {visibleOptionColumns.includes('Type') && (
                                  <TableCell>{String(type)}</TableCell>
                                )}
                                {visibleOptionColumns.includes('Expiration') && (
                                  <TableCell>{String(expiration)}</TableCell>
                                )}
                                {visibleOptionColumns.includes('Quantity') && (
                                  <TableCell>{String(position.units || '-')}</TableCell>
                                )}
                                {visibleOptionColumns.includes('Market Value') && (
                                  <TableCell>{typeof position.market_value === 'number' ? position.market_value.toFixed(2) : '-'}</TableCell>
                                )}
                                {visibleOptionColumns.includes('Unrealized P/L') && (
                                  <TableCell>{typeof position.open_pnl === 'number' ? position.open_pnl.toFixed(2) : '-'}</TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    };

    // Drag and drop logic for equity columns
    type EquityCol =
      | 'Symbol'
      | 'Price'
      | 'Value'
      | 'Quantity'
      | 'Purchase Price'
      | 'Unrealized P/L';

    const equityColDefs: EquityCol[] = [
      'Symbol', 'Price', 'Value', 'Quantity', 'Purchase Price', 'Unrealized P/L'
    ];

    // DnD item type
    const DND_TYPE = 'equity-col';

    interface DragItem {
      index: number;
      col: EquityCol;
      type: string;
    }

    // Draggable label for equity column
    const DraggableEquityCol = ({
      col,
      index,
      moveCol,
      checked,
      onToggle,
    }: {
      col: EquityCol;
      index: number;
      moveCol: (from: number, to: number) => void;
      checked: boolean;
      onToggle: () => void;
    }) => {
      const ref = useRef<HTMLLabelElement>(null);
      const [, drop] = useDrop<DragItem, unknown, unknown>({
        accept: DND_TYPE,
        hover(item: DragItem, monitor: DropTargetMonitor) {
          if (!ref.current) return;
          const dragIndex = item.index;
          const hoverIndex = index;
          if (dragIndex === hoverIndex) return;
          moveCol(dragIndex, hoverIndex);
          item.index = hoverIndex;
        },
      });
      const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>({
        type: DND_TYPE,
        item: { index, col, type: DND_TYPE },
        collect: (monitor: DragSourceMonitor) => ({
          isDragging: monitor.isDragging(),
        }),
      });
      drag(drop(ref));
      return (
        <label
          ref={ref}
          className={`flex items-center gap-1 text-sm cursor-move px-1 py-0.5 rounded ${isDragging ? 'opacity-50 bg-gray-200 dark:bg-zinc-700' : ''}`}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
          />
          {col}
        </label>
      );
    };

    // Move column in visibleEquityColumns
    const moveEquityCol = useCallback((from: number, to: number) => {
      setVisibleEquityColumns(prev => {
        const next = [...prev];
        const [removed] = next.splice(from, 1);
        next.splice(to, 0, removed);
        return next;
      });
    }, []);

    return (
      <DndProvider backend={HTML5Backend}>
        <div className="w-full mx-auto py-10">
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
          </div>
          <div className="flex flex-col gap-6 w-full">
            <details className="bg-white dark:bg-zinc-900 rounded-md shadow-md border">
              <summary className="cursor-pointer px-6 py-4 text-lg font-semibold border-b dark:border-zinc-700">
                Options (Total: ${
                  options.reduce((sum, p) => sum + (typeof p.market_value === 'number' ? p.market_value : 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                })
              </summary>
              <div className="p-4 overflow-x-auto">
                {/* Option column dropdown */}
                <div className="flex justify-end mb-4 relative">
                  <button
                    onClick={() => setShowOptionDropdown(prev => !prev)}
                    className="text-xl"
                    aria-label="Toggle columns"
                    type="button"
                  >
                    {/* Three-bar icon */}
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <rect x="4" y="7" width="16" height="2" rx="1" fill="currentColor" />
                      <rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" />
                      <rect x="4" y="15" width="16" height="2" rx="1" fill="currentColor" />
                    </svg>
                  </button>
                  {showOptionDropdown && (
                    <div className="absolute top-full right-0 bg-white dark:bg-zinc-800 p-2 border rounded shadow-md z-10">
                      {(['Underlying', 'Strike', 'Type', 'Expiration', 'Quantity', 'Market Value', 'Unrealized P/L'] as const).map(col => (
                        <label key={col} className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={visibleOptionColumns.includes(col)}
                            onChange={() => toggleOptionColumn(col)}
                          />
                          {col}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {renderOptionsTable(options)}
              </div>
            </details>
            {/* Equity three-bar button outside details summary */}
            <div className="flex justify-end mb-2 relative">
              <button
                onClick={() => setShowEquityDropdown(prev => !prev)}
                className="text-xl"
                aria-label="Toggle columns"
                type="button"
              >
                {/* Three-bar icon */}
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <rect x="4" y="7" width="16" height="2" rx="1" fill="currentColor" />
                  <rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" />
                  <rect x="4" y="15" width="16" height="2" rx="1" fill="currentColor" />
                </svg>
              </button>
              {showEquityDropdown && (
                <div className="absolute top-full right-0 bg-white dark:bg-zinc-800 p-2 border rounded shadow-md z-10 min-w-[180px]">
                  {visibleEquityColumns.map((col, idx) => (
                    <DraggableEquityCol
                      key={col}
                      col={col}
                      index={idx}
                      moveCol={moveEquityCol}
                      checked={visibleEquityColumns.includes(col)}
                      onToggle={() => toggleEquityColumn(col)}
                    />
                  ))}
                  {/* Show all remaining columns not in visibleEquityColumns as unchecked */}
                  {equityColDefs.filter(col => !visibleEquityColumns.includes(col)).map((col, idx) => (
                    <DraggableEquityCol
                      key={col}
                      col={col}
                      index={visibleEquityColumns.length + idx}
                      moveCol={() => {}}
                      checked={false}
                      onToggle={() => toggleEquityColumn(col)}
                    />
                  ))}
                  <div className="text-xs text-gray-400 mt-1">Drag to reorder columns</div>
                </div>
              )}
            </div>
            <details className="bg-white dark:bg-zinc-900 rounded-md shadow-md border">
              <summary className="cursor-pointer px-6 py-4 text-lg font-semibold border-b dark:border-zinc-700">
                Equities (Total: ${
                  equities.reduce((sum, p) => sum + (typeof p.market_value === 'number' ? p.market_value : 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                })
              </summary>
              <div className="p-4 overflow-x-auto">
                {renderEquitiesTable(equities)}
              </div>
            </details>
          </div>
        </div>
      </DndProvider>
    );
};

export default PositionsPage;
'use client';

import type { OptionPosition } from '@/app/actions/portfolio-analytics';

function toOptionPositions(positions: Position[]): OptionPosition[] {
  return positions
    .filter(p => p.symbol?.option_symbol)
    .map(p => ({
      symbol: {
        option_symbol: {
          ticker: p.symbol?.symbol ?? '',
          option_type: p.symbol?.option_symbol?.option_type === 'CALL' ? 'CALL' : 'PUT',
          strike_price: p.symbol?.option_symbol?.strike_price ?? 0,
          expiration_date: p.symbol?.option_symbol?.expiration_date ?? '',
          underlying_symbol: {
            symbol: p.symbol?.option_symbol?.underlying_symbol?.symbol ?? '',
            description: p.symbol?.description ?? '',
          },
        },
      },
      units: p.units ?? 0,
      price: p.price ?? 0,
      average_purchase_price: p.average_purchase_price ?? 0,
      currency: p.currency?.code ? { code: p.currency.code } : { code: 'USD' },
    }));
}


import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSnapTradePositions } from '../../../hooks/useSnapTrade';

// Equity column types
type EquityCol =
  | 'Symbol'
  | 'Price'
  | 'Value'
  | 'Quantity'
  | 'Purchase Price'
  | 'Unrealized P/L'
  | 'P/L %';

// Option column types
type OptionCol =
  | 'Underlying'
  | 'Strike'
  | 'Type'
  | 'Expiration'
  | 'Quantity'
  | 'Price'
  | 'Purchase Price'
  | 'Value'
  | 'Unrealized P/L'
  | 'P/L %';

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
  value: number | null | undefined;
  units: number | null | undefined;
  average_purchase_price: number | null | undefined;
  realized_pnl: number | null | undefined;
  open_pnl: number | null | undefined;
  currency: { code: string; name: string; id: string } | null | undefined;
}

// Draggable column item component for equity columns
const SortableEquityColumnItem = ({
  col,
  checked,
  onToggle,
}: {
  col: EquityCol;
  checked: boolean;
  onToggle: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col });

  const dragStyleClass = isDragging ? 'z-[1000] transition-transform' : '';
  const transformStyle = transform ? CSS.Transform.toString(transform) : undefined;
  // Use inline style only for transform (not transition/zIndex)
  const style = transformStyle ? { transform: transformStyle } : undefined;

  return (
    <div
      ref={setNodeRef}
      /* webhint-ignore no-inline-styles */
      style={style}
      {...attributes}
      {...listeners}
      className={`${dragStyleClass} flex items-center gap-2 text-sm cursor-move px-3 py-2 rounded transition-all border ${
        isDragging
          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 opacity-50 z-50'
          : 'bg-gray-50 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer"
        aria-label={`Toggle ${col} column visibility`}
      />
      <span className="select-none">{col}</span>
    </div>
  );
};

// Draggable column item component for option columns
const SortableOptionColumnItem = ({
  col,
  checked,
  onToggle,
}: {
  col: OptionCol;
  checked: boolean;
  onToggle: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col });

  const dragStyleClass = isDragging ? 'z-[1000] transition-transform' : '';
  const transformStyle = transform ? CSS.Transform.toString(transform) : undefined;
  const style = transformStyle ? { transform: transformStyle } : undefined;

  return (
    <div
      ref={setNodeRef}
      /* webhint-ignore no-inline-styles */
      style={style}
      {...attributes}
      {...listeners}
      className={`${dragStyleClass} flex items-center gap-2 text-sm cursor-move px-3 py-2 rounded transition-all border ${
        isDragging
          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 opacity-50 z-50'
          : 'bg-gray-50 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer"
        aria-label={`Toggle ${col} column visibility`}
      />
      <span className="select-none">{col}</span>
    </div>
  );
};
import {
  calculateEquitiesBalance,
  calculateOptionsBalance,
  calculateCryptoBalance,
  calculateOtherAssetsBalance
} from '@/app/actions/portfolio-analytics';

// Three bars icon component
const ThreeBarsIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="text-gray-600 dark:text-gray-300">
    <rect x="4" y="6" width="16" height="2" rx="1" fill="currentColor" />
    <rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" />
    <rect x="4" y="16" width="16" height="2" rx="1" fill="currentColor" />
  </svg>
);

// Arrow icon component
const ArrowIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const PositionsPage = () => {
  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // SnapTrade hook for real data
  const { data: positions, isLoading, error } = useSnapTradePositions();
  const safePositions: Position[] = Array.isArray(positions) ? positions : [];
  const [filter, setFilter] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'equity' | 'option' | null>(null);
  
  // Dynamic column management state and toggles
  const [showOptionDropdown, setShowOptionDropdown] = useState(false);
  const [showEquityDropdown, setShowEquityDropdown] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [equitiesExpanded, setEquitiesExpanded] = useState(true);
  
  const [visibleEquityColumns, setVisibleEquityColumns] = useState<EquityCol[]>([
    'Symbol', 'Price', 'Value', 'Quantity', 'Purchase Price', 'Unrealized P/L', 'P/L %'
  ]);

  const [visibleOptionColumns, setVisibleOptionColumns] = useState<OptionCol[]>([
    'Underlying', 'Strike', 'Type', 'Expiration', 'Quantity', 'Price', 'Purchase Price', 'Value', 'Unrealized P/L', 'P/L %'
  ]);

  const { equities, options }: { equities: Position[]; options: Position[] } = useMemo(() => {
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
  if (error) return <p>Error loading positions: {String(error)}</p>;
  if (!Array.isArray(positions)) return <p>Unexpected data format.</p>;

  const toggleEquityColumn = (col: EquityCol) => {
    setVisibleEquityColumns(prev =>
      prev.includes(col)
        ? prev.filter(c => c !== col)
        : [...prev, col]
    );
  };

  const toggleOptionColumn = (col: OptionCol) => {
    setVisibleOptionColumns(prev =>
      prev.includes(col)
        ? prev.filter(c => c !== col)
        : [...prev, col]
    );
  };

  // Handle drag events for equity columns
  const handleEquityDragStart = (event: any) => {
    setActiveId(event.active.id);
    setActiveType('equity');
  };

  const handleEquityDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (active.id !== over?.id) {
      setVisibleEquityColumns((items) => {
        const oldIndex = items.indexOf(active.id as EquityCol);
        const newIndex = items.indexOf(over?.id as EquityCol);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle drag events for option columns
  const handleOptionDragStart = (event: any) => {
    setActiveId(event.active.id);
    setActiveType('option');
  };

  const handleOptionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (active.id !== over?.id) {
      setVisibleOptionColumns((items) => {
        const oldIndex = items.indexOf(active.id as OptionCol);
        const newIndex = items.indexOf(over?.id as OptionCol);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Table for equities
  const renderEquitiesTable = (data: Position[] | undefined) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <p className="text-gray-500 p-4">No equities available.</p>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700">
              {visibleEquityColumns.map((col) => (
                <th key={col} className="text-left p-3 font-medium text-gray-700 dark:text-gray-300">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
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
                <tr key={index} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  {visibleEquityColumns.map((col) => (
                    <td key={col} className="p-3 text-gray-800 dark:text-gray-200">
                      {col === 'Symbol' && String(symbolToDisplay)}
                      {col === 'Price' &&
                        (typeof position.price === 'number'
                          ? (
                            position.price < 0
                              ? `-$${Math.abs(position.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `$${(position.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )
                          : '-')}
                      {col === 'Value' &&
                        (
                          (position.units || 0) * (position.price || 0) < 0
                            ? `-$${Math.abs((position.units || 0) * (position.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${((position.units || 0) * (position.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      {col === 'Quantity' && (position.units || 0).toFixed(2)}
                      {col === 'Purchase Price' &&
                        (typeof position.average_purchase_price === 'number'
                          ? (
                            position.average_purchase_price < 0
                              ? `-$${Math.abs(position.average_purchase_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `$${(position.average_purchase_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )
                          : '-')}
                      {col === 'Unrealized P/L' &&
                        (typeof position.open_pnl === 'number'
                          ? (
                            position.open_pnl < 0
                              ? `-$${Math.abs(position.open_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `$${(position.open_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )
                          : '-')}
                      {col === 'P/L %' && (
                        position.average_purchase_price
                          ? `${(((position.price || 0) - (position.average_purchase_price || 0)) / (position.average_purchase_price || 0) * 100).toFixed(2)}%`
                          : '-'
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Table for options
  const renderOptionsTable = (data: Position[] | undefined) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <p className="text-gray-500 p-4">No options available.</p>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700">
              {visibleOptionColumns.map((col) => (
                <th key={col} className="text-left p-3 font-medium text-gray-700 dark:text-gray-300">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((position, index) => {
              if (!position) return null;
              const option = position.symbol?.option_symbol;
              const underlying = option?.underlying_symbol?.symbol || '-';
              const strike = option?.strike_price !== undefined ? option.strike_price : '-';
              const type = option?.option_type || '-';
              const expiration = option?.expiration_date || '-';
              return (
                <tr key={index} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  {visibleOptionColumns.map((col) => (
                    <td key={col} className="p-3 text-gray-800 dark:text-gray-200">
                      {col === 'Underlying' && String(underlying)}
                      {col === 'Strike' && String(strike)}
                      {col === 'Type' && String(type)}
                      {col === 'Expiration' && String(expiration)}
                      {col === 'Quantity' && String(position.units || '-')}
                      {col === 'Price' &&
                        (
                          (position.price || 0) < 0
                            ? `-$${Math.abs(position.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${(position.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      {col === 'Purchase Price' &&
                        (
                          (position.average_purchase_price || 0) < 0
                            ? `-$${Math.abs(position.average_purchase_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${(position.average_purchase_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      {col === 'Value' &&
                        (
                          ((position.units || 0) * (position.price || 0) * 100) < 0
                            ? `-$${Math.abs((position.units || 0) * (position.price || 0) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${((position.units || 0) * (position.price || 0) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      {col === 'Unrealized P/L' && (
                        (() => {
                          const units = position.units || 0;
                          const price = position.price || 0;
                          const currentValue = units * price * 100;
                          const costBasis = units * (position.average_purchase_price || 0);
                          const pnl = currentValue - costBasis;
                          return pnl < 0
                            ? `-$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        })()
                      )}
                      {col === 'P/L %' && (
                        position.average_purchase_price
                          ? (() => {
                              const units = position.units || 0;
                              const price = position.price || 0;
                              // current market value per contract
                              const currentValue = units * price * 100;
                              // purchase price already multiplied by 100
                              const costBasis = units * (position.average_purchase_price || 0);
                              const pnlPercent = costBasis !== 0 
                                ? ((currentValue - costBasis) / Math.abs(costBasis) * 100)
                                : 0;
                              return `${pnlPercent.toFixed(2)}%`;
                            })()
                          : '-'
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // All column types
  const allEquityColumns: EquityCol[] = [
    'Symbol', 'Price', 'Value', 'Quantity', 'Purchase Price', 'Unrealized P/L', 'P/L %'
  ];

  const allOptionColumns: OptionCol[] = [
    'Underlying', 'Strike', 'Type', 'Expiration', 'Quantity', 'Price', 'Purchase Price', 'Value', 'Unrealized P/L', 'P/L %'
  ];

  // Get columns not currently visible
  const hiddenEquityColumns = allEquityColumns.filter(col => !visibleEquityColumns.includes(col));
  const hiddenOptionColumns = allOptionColumns.filter(col => !visibleOptionColumns.includes(col));

  return (
    <div className="w-full mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Positions</h1>
      
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label htmlFor="filter" className="block text-sm font-medium mb-1">Filter by Symbol</label>
          <input
            id="filter"
            type="text"
            placeholder="Enter symbol..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full">
        {/* Options Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-gray-200 dark:border-zinc-700">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
            <button
              onClick={() => setOptionsExpanded(!optionsExpanded)}
              className="flex items-center gap-3 text-lg font-semibold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowIcon expanded={optionsExpanded} />
              <span>
                Options (Total: ${
                  calculateOptionsBalance(toOptionPositions(options))
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                })
              </span>
            </button>
            
            {optionsExpanded && (
              <div className="relative">
                <button
                  onClick={() => setShowOptionDropdown(!showOptionDropdown)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                  aria-label="Toggle columns"
                  type="button"
                >
                  <ThreeBarsIcon />
                </button>
                {showOptionDropdown && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleOptionDragStart}
                    onDragEnd={handleOptionDragEnd}
                  >
                    <div className="absolute top-full right-0 bg-white dark:bg-zinc-800 p-4 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-lg z-20 min-w-[220px]">
                      <div className="space-y-2">
                        <SortableContext items={visibleOptionColumns} strategy={verticalListSortingStrategy}>
                          {visibleOptionColumns.map((col) => (
                            <SortableOptionColumnItem
                              key={col}
                              col={col}
                              checked={true}
                              onToggle={() => toggleOptionColumn(col)}
                            />
                          ))}
                        </SortableContext>
                        
                        {/* Show hidden columns as non-draggable checkboxes */}
                        {hiddenOptionColumns.map((col) => (
                          <div key={col} className="flex items-center gap-2 text-sm px-3 py-2 rounded bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600">
                            <div className="w-6"></div> {/* Spacer for drag handle */}
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => toggleOptionColumn(col)}
                              className="cursor-pointer"
                              title={`Toggle ${col} column visibility`}
                            />
                            <span className="select-none">{col}</span>
                          </div>
                        ))}
                        
                        <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200 dark:border-zinc-600">
                          Drag visible columns to reorder
                        </div>
                      </div>
                    </div>
                    <DragOverlay>
                      {activeId && activeType === 'option' ? (
                        <div className="flex items-center gap-2 text-sm cursor-move px-3 py-2 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 shadow-lg">
                          <input
                            type="checkbox"
                            checked={true}
                            readOnly
                            className="cursor-pointer"
                            title="Column checkbox"
                          />
                          <span className="select-none">{String(activeId)}</span>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </div>
            )}
          </div>
          {optionsExpanded && (
            <div className="p-6">
              {renderOptionsTable(options)}
            </div>
          )}
        </div>
        
        {/* Equities Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-gray-200 dark:border-zinc-700">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
            <button
              onClick={() => setEquitiesExpanded(!equitiesExpanded)}
              className="flex items-center gap-3 text-lg font-semibold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowIcon expanded={equitiesExpanded} />
              <span>
                Equities (Total: ${
                  (
                    calculateEquitiesBalance(equities) +
                    calculateCryptoBalance(equities) +
                    calculateOtherAssetsBalance(equities)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                })
              </span>
            </button>
            
            {equitiesExpanded && (
              <div className="relative">
                <button
                  onClick={() => setShowEquityDropdown(!showEquityDropdown)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                  aria-label="Toggle columns"
                  type="button"
                >
                  <ThreeBarsIcon />
                </button>
                {showEquityDropdown && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleEquityDragStart}
                    onDragEnd={handleEquityDragEnd}
                  >
                    <div className="absolute top-full right-0 bg-white dark:bg-zinc-800 p-4 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-lg z-20 min-w-[220px]">
                      <div className="space-y-2">
                        <SortableContext items={visibleEquityColumns} strategy={verticalListSortingStrategy}>
                          {visibleEquityColumns.map((col) => (
                            <SortableEquityColumnItem
                              key={col}
                              col={col}
                              checked={true}
                              onToggle={() => toggleEquityColumn(col)}
                            />
                          ))}
                        </SortableContext>
                        
                        {/* Show hidden columns as non-draggable checkboxes */}
                        {hiddenEquityColumns.map((col) => (
                          <div key={col} className="flex items-center gap-2 text-sm px-3 py-2 rounded bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600">
                            <div className="w-6"></div> {/* Spacer for drag handle */}
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => toggleEquityColumn(col)}
                              className="cursor-pointer"
                              title={`Toggle ${col} column visibility`}
                            />
                            <span className="select-none">{col}</span>
                          </div>
                        ))}
                        
                        <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200 dark:border-zinc-600">
                          Drag visible columns to reorder
                        </div>
                      </div>
                    </div>
                    <DragOverlay>
                      {activeId && activeType === 'equity' ? (
                        <div className="flex items-center gap-2 text-sm cursor-move px-3 py-2 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 shadow-lg">
                          <input
                            type="checkbox"
                            checked={true}
                            readOnly
                            className="cursor-pointer"
                            title="Column checkbox"
                          />
                          <span className="select-none">{String(activeId)}</span>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </div>
            )}
          </div>
          {equitiesExpanded && (
            <div className="p-6">
              {renderEquitiesTable(equities)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionsPage;
'use client';


import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getUserHoldings } from '@/app/actions/snaptrade';
import { useCachedAccounts } from '@/hooks/use-cached-accounts';

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
    symbol?: {
      symbol?: string;
      type?: {
        code?: string;
        description?: string;
      };
    };
    option_symbol?: {
      underlying_symbol?: { symbol?: string };
      option_type?: string;
      strike_price?: number;
      expiration_date?: string;
    };
    id?: string;
    description?: string;
    local_id?: string;
  } | null | undefined;
  price: number | null | undefined;
  units: number | null | undefined;
  average_purchase_price: number | null | undefined;
  open_pnl: number | null | undefined;
  fractional_units?: number | null | undefined;
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
    isDragging,
  } = useSortable({ id: col });

  const dragStyleClass = isDragging ? 'z-[1000] transition-transform' : '';
  const transformStyle = transform ? CSS.Transform.toString(transform) : undefined;
  // Use inline style only for transform (not transition/zIndex)
  const style = transformStyle ? { transform: transformStyle } : undefined;

  return (
    <div
      ref={setNodeRef}
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
    isDragging,
  } = useSortable({ id: col });

  const dragStyleClass = isDragging ? 'z-[1000] transition-transform' : '';
  const transformStyle = transform ? CSS.Transform.toString(transform) : undefined;
  const style = transformStyle ? { transform: transformStyle } : undefined;

  return (
    <div
      ref={setNodeRef}
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

  // Auth and SnapTrade credentials logic
  const { user } = useAuth();
  const firebaseUserId = user?.uid;

  // Filter states
  const [filter, setFilter] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [positionType, setPositionType] = useState<'all' | 'common_stock' | 'options' | 'crypto' | 'etf' | 'bond'>('all');
  const [profitabilityFilter, setProfitabilityFilter] = useState<'all' | 'profitable' | 'losing'>('all');
  const [showPositionSizeDropdown, setShowPositionSizeDropdown] = useState(false);
  const [minPositionSize, setMinPositionSize] = useState<string>('');
  const [maxPositionSize, setMaxPositionSize] = useState<string>('');
  const [showClearFiltersDropdown, setShowClearFiltersDropdown] = useState(false);
  const positionSizeDropdownRef = useRef<HTMLDivElement>(null);
  const clearFiltersDropdownRef = useRef<HTMLDivElement>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Rotate through: desc -> asc -> none (3 states)
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // Reset to no sort (asc -> none)
        setSortColumn('');
        setSortDirection('desc'); // Reset direction for next time
      }
    } else {
      // First click on new column starts with desc
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Sort indicator component - only show when column is actively sorted
  const SortIndicator = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return null; // Don't show any arrow when not sorted
    }
    return (
      <span className="text-blue-600 ml-1">
        {sortDirection === 'desc' ? '↓' : '↑'}
      </span>
    );
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (positionSizeDropdownRef.current && !positionSizeDropdownRef.current.contains(event.target as Node)) {
        setShowPositionSizeDropdown(false);
      }
      if (clearFiltersDropdownRef.current && !clearFiltersDropdownRef.current.contains(event.target as Node)) {
        setShowClearFiltersDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { data: snaptradeCredentials } = useQuery({
    queryKey: ['snaptradeCredentials', firebaseUserId],
    queryFn: async () => {
      if (!firebaseUserId) throw new Error('Missing Firebase user ID');
      const res = await fetch(`/api/firebase/getCredentials?firebaseUserId=${firebaseUserId}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      return res.json();
    },
    enabled: !!firebaseUserId,
  });

  const snaptradeUserId = snaptradeCredentials?.snaptradeUserId;
  const userSecret = snaptradeCredentials?.userSecret;
  const enabled = !!snaptradeUserId && !!userSecret;

  // Get cached accounts for filtering
  const { accounts } = useCachedAccounts();

  const { data: holdingsData, isLoading, error } = useQuery({
    queryKey: ['holdings', snaptradeUserId, userSecret, selectedAccount],
    queryFn: () => getUserHoldings(
      snaptradeUserId!, 
      userSecret!, 
      selectedAccount === 'all' ? undefined : selectedAccount
    ),
    enabled,
  });

  const safePositions: Position[] = Array.isArray(holdingsData?.positions) ? holdingsData.positions : [];
  const safeOptionPositions = Array.isArray(holdingsData?.option_positions) ? holdingsData.option_positions : [];
  // Debug logging for raw and safe positions
  console.log('Raw holdings from query:', holdingsData);
  console.log('SafePositions (equity):', safePositions);
  console.log('SafeOptionPositions:', safeOptionPositions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'equity' | 'option' | null>(null);
  
  // Dynamic column management state and toggles
  const [showOptionDropdown, setShowOptionDropdown] = useState(false);
  const [showEquityDropdown, setShowEquityDropdown] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState(true);
  const [equitiesExpanded, setEquitiesExpanded] = useState(true);
  
  const [visibleEquityColumns, setVisibleEquityColumns] = useState<EquityCol[]>([
    'Symbol', 'Price', 'Value', 'Quantity', 'Purchase Price', 'Unrealized P/L', 'P/L %'
  ]);

  const [visibleOptionColumns, setVisibleOptionColumns] = useState<OptionCol[]>([
    'Underlying', 'Strike', 'Type', 'Expiration', 'Quantity', 'Price', 'Purchase Price', 'Value', 'Unrealized P/L', 'P/L %'
  ]);

  // Get unique symbols for dropdown (including both regular stocks and underlying stocks from options)
  const availableSymbols = useMemo(() => {
    if (!Array.isArray(safePositions) && !Array.isArray(safeOptionPositions)) {
      return [];
    }
    
    // Get symbols from regular equity positions - updated for SnapTrade API structure
    const equitySymbols = (Array.isArray(safePositions) ? safePositions : [])
      .map(position => position?.symbol?.symbol?.symbol) // nested symbol.symbol.symbol
      .filter((symbol): symbol is string => Boolean(symbol) && typeof symbol === 'string');
    
    // Get underlying symbols from options - updated for SnapTrade API structure
    const optionUnderlyingSymbols = (Array.isArray(safeOptionPositions) ? safeOptionPositions : [])
      .map(option => option?.symbol?.option_symbol?.underlying_symbol?.symbol)
      .filter((symbol): symbol is string => Boolean(symbol) && typeof symbol === 'string');
    
    // Combine all unique symbols (regular stocks + underlying stocks from options)
    const allSymbols = [...new Set([...equitySymbols, ...optionUnderlyingSymbols])];
    return allSymbols.sort();
  }, [safePositions, safeOptionPositions]);

  const { equities, options }: { equities: Position[]; options: any[] } = useMemo(() => {
    let filteredEquities = Array.isArray(safePositions) ? safePositions : [];
    let filteredOptions = Array.isArray(safeOptionPositions) ? safeOptionPositions : [];
    
    // Filter by symbol dropdown - updated for SnapTrade API structure
    if (filter && filter !== 'all') {
      filteredEquities = filteredEquities.filter(position => {
        const equitySymbol = position?.symbol?.symbol?.symbol; // nested symbol.symbol.symbol
        return equitySymbol === filter;
      });
      
      filteredOptions = filteredOptions.filter(option => {
        const optionSymbol = option?.symbol?.option_symbol?.underlying_symbol?.symbol;
        return optionSymbol === filter;
      });
    }

    // Filter by position type
    if (positionType !== 'all') {
      if (positionType === 'options') {
        filteredEquities = []; // Hide equities when showing only options
      } else {
        // Filter equities by security type - updated for SnapTrade API structure
        filteredEquities = filteredEquities.filter(position => {
          const typeCode = position?.symbol?.symbol?.type?.code; // Use symbol.symbol.type.code
          const typeDescription = position?.symbol?.symbol?.type?.description;
          const symbol = position?.symbol?.symbol?.symbol;
          
          console.log('Position filtering debug:', {
            symbol,
            typeCode,
            typeDescription,
            positionType,
            symbolStructure: position?.symbol?.symbol
          });
          
          switch (positionType) {
            case 'common_stock':
              // SnapTrade uses 'cs' for common stock based on your example
              return typeCode === 'cs' || 
                     typeDescription === 'Common Stock' ||
                     typeCode === 'equity' ||
                     typeCode === 'stock' ||
                     (!typeCode && symbol && typeof symbol === 'string'); // fallback for positions without explicit type
            case 'crypto':
              return typeCode === 'crypto' || 
                     typeCode === 'cryptocurrency' ||
                     typeDescription?.toLowerCase().includes('crypto');
            case 'etf':
              return typeCode === 'etf' || 
                     typeCode === 'fund' ||
                     typeDescription?.toLowerCase().includes('etf') ||
                     typeDescription?.toLowerCase().includes('fund');
            case 'bond':
              return typeCode === 'bond' || 
                     typeCode === 'fixed_income' ||
                     typeDescription?.toLowerCase().includes('bond');
            default:
              return true;
          }
        });
        
        // Hide options for non-option filters
        filteredOptions = [];
      }
    }

    // Filter by profitability - updated for SnapTrade API structure
    if (profitabilityFilter !== 'all') {
      filteredEquities = filteredEquities.filter(position => {
        const pnl = position.open_pnl || 0; // SnapTrade provides open_pnl directly
        return profitabilityFilter === 'profitable' ? pnl > 0 : pnl < 0;
      });
      
      filteredOptions = filteredOptions.filter(option => {
        // For options, calculate P&L since SnapTrade structure doesn't include open_pnl for options
        const units = option.units || 0;
        const currentPrice = option.price || 0;
        const avgPurchasePrice = option.average_purchase_price || 0;
        
        // Calculate current market value and cost basis
        const currentValue = Math.abs(units) * currentPrice * 100; // Options multiplier
        const costBasis = Math.abs(units) * avgPurchasePrice;
        
        // Calculate P&L (consider if position is long or short)
        let pnl;
        if (units > 0) {
          // Long position: current value - cost basis
          pnl = currentValue - costBasis;
        } else {
          // Short position: cost basis - current value
          pnl = costBasis - currentValue;
        }
        
        return profitabilityFilter === 'profitable' ? pnl > 0 : pnl < 0;
      });
    }

    // Filter by position size range (min/max) - updated for SnapTrade API structure
    const minPos = minPositionSize && !isNaN(parseFloat(minPositionSize)) ? parseFloat(minPositionSize) : null;
    const maxPos = maxPositionSize && !isNaN(parseFloat(maxPositionSize)) ? parseFloat(maxPositionSize) : null;
    
    if (minPos !== null || maxPos !== null) {
      filteredEquities = filteredEquities.filter(position => {
        const units = position.units || 0;
        const price = position.price || 0;
        const value = Math.abs(units * price); // Position value
        if (minPos !== null && value < minPos) return false;
        if (maxPos !== null && value > maxPos) return false;
        return true;
      });
      
      filteredOptions = filteredOptions.filter(option => {
        const units = Math.abs(option.units || 0);
        const price = option.price || 0;
        const value = units * price * 100; // Options value with multiplier
        if (minPos !== null && value < minPos) return false;
        if (maxPos !== null && value > maxPos) return false;
        return true;
      });
    }
    
    // Debug logging for filtered/derived positions
    console.log('Filtered equities:', filteredEquities);
    console.log('Filtered options:', filteredOptions);
    return { equities: filteredEquities, options: filteredOptions };
  }, [safePositions, safeOptionPositions, filter, positionType, profitabilityFilter, minPositionSize, maxPositionSize]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <p>Error loading holdings: {String(error)}</p>;
  if (holdingsData && 'error' in holdingsData) return <p>Error: {holdingsData.error}</p>;

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

  // Sort data array
  const sortData = (data: any[], column: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aValue: any = null;
      let bValue: any = null;

      // Get values based on column name
      switch (column) {
        case 'Symbol':
          aValue = a.symbol?.symbol?.symbol || '';
          bValue = b.symbol?.symbol?.symbol || '';
          break;
        case 'Price':
          // Check if this is option data (has option_symbol) and multiply by 100
          aValue = a.symbol?.option_symbol ? (a.price || 0) * 100 : (a.price || 0);
          bValue = b.symbol?.option_symbol ? (b.price || 0) * 100 : (b.price || 0);
          break;
        case 'Value':
          aValue = (a.units || 0) * (a.price || 0);
          bValue = (b.units || 0) * (b.price || 0);
          break;
        case 'Quantity':
          aValue = a.units || 0;
          bValue = b.units || 0;
          break;
        case 'Purchase Price':
          aValue = a.average_purchase_price || 0;
          bValue = b.average_purchase_price || 0;
          break;
        case 'Unrealized P/L':
          aValue = a.open_pnl || 0;
          bValue = b.open_pnl || 0;
          break;
        case 'P/L %':
          aValue = a.average_purchase_price ? ((a.price || 0) - a.average_purchase_price) / a.average_purchase_price * 100 : 0;
          bValue = b.average_purchase_price ? ((b.price || 0) - b.average_purchase_price) / b.average_purchase_price * 100 : 0;
          break;
        // Option columns
        case 'Underlying':
          aValue = a.symbol?.option_symbol?.underlying_symbol?.symbol || '';
          bValue = b.symbol?.option_symbol?.underlying_symbol?.symbol || '';
          break;
        case 'Strike':
          aValue = a.symbol?.option_symbol?.strike_price || 0;
          bValue = b.symbol?.option_symbol?.strike_price || 0;
          break;
        case 'Type':
          aValue = a.symbol?.option_symbol?.option_type || '';
          bValue = b.symbol?.option_symbol?.option_type || '';
          break;
        case 'Expiration':
          aValue = a.symbol?.option_symbol?.expiration_date || '';
          bValue = b.symbol?.option_symbol?.expiration_date || '';
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      // Handle string vs number comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      } else {
        const numA = Number(aValue) || 0;
        const numB = Number(bValue) || 0;
        return direction === 'asc' ? numA - numB : numB - numA;
      }
    });
  };

  // Table for equities
  const renderEquitiesTable = (data: Position[] | undefined) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <p className="text-gray-500 p-4">No equities available.</p>;
    }

    // Sort data if a column is selected
    const sortedData = sortColumn ? sortData(data, sortColumn, sortDirection) : data;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700">
              {visibleEquityColumns.map((col) => (
                <th 
                  key={col} 
                  className="text-left p-3 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 select-none"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center">
                    {col}
                    <SortIndicator column={col} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((position, index) => {
              if (!position) return null;
              // Updated for SnapTrade API structure: symbol.symbol.symbol
              const symbolToDisplay = position.symbol?.symbol?.symbol || 
                                    position.symbol?.description || 
                                    position.symbol?.local_id || '-';
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
  const renderOptionsTable = (data: any[] | undefined) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <p className="text-gray-500 p-4">No options available.</p>;
    }

    // Sort data if a column is selected
    const sortedData = sortColumn ? sortData(data, sortColumn, sortDirection) : data;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700">
              {visibleOptionColumns.map((col) => (
                <th 
                  key={col} 
                  className="text-left p-3 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 select-none"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center">
                    {col}
                    <SortIndicator column={col} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((option, index) => {
              if (!option) return null;
              const optionSymbol = option.symbol?.option_symbol;
              const underlying = optionSymbol?.underlying_symbol?.symbol || '-';
              const strike = optionSymbol?.strike_price !== undefined ? optionSymbol.strike_price : '-';
              const type = optionSymbol?.option_type || '-';
              const expiration = optionSymbol?.expiration_date || '-';
              return (
                <tr key={index} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  {visibleOptionColumns.map((col) => (
                    <td key={col} className="p-3 text-gray-800 dark:text-gray-200">
                      {col === 'Underlying' && String(underlying)}
                      {col === 'Strike' && String(strike)}
                      {col === 'Type' && String(type)}
                      {col === 'Expiration' && String(expiration)}
                      {col === 'Quantity' && String(option.units || '-')}
                      {col === 'Price' &&
                        (
                          ((option.price || 0) * 100) < 0
                            ? `-$${Math.abs((option.price || 0) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${((option.price || 0) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      {col === 'Purchase Price' &&
                        (
                          (option.average_purchase_price || 0) < 0
                            ? `-$${Math.abs(option.average_purchase_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${(option.average_purchase_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      {col === 'Value' &&
                        (
                          ((option.units || 0) * (option.price || 0) * 100) < 0
                            ? `-$${Math.abs((option.units || 0) * (option.price || 0) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${((option.units || 0) * (option.price || 0) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      {col === 'Unrealized P/L' && (
                        (() => {
                          const units = option.units || 0;
                          const price = option.price || 0;
                          const currentValue = units * price * 100;
                          const costBasis = units * (option.average_purchase_price || 0);
                          const pnl = currentValue - costBasis;
                          return pnl < 0
                            ? `-$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        })()
                      )}
                      {col === 'P/L %' && (
                        option.average_purchase_price
                          ? (() => {
                              const units = option.units || 0;
                              const price = option.price || 0;
                              // current market value per contract
                              const currentValue = units * price * 100;
                              // purchase price already multiplied by 100
                              const costBasis = units * (option.average_purchase_price || 0);
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="filter" className="block text-sm font-medium mb-1">Filter by Symbol</label>
          <select
            id="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Symbols</option>
            {availableSymbols.map((symbol, index) => (
              <option key={`symbol-${symbol}-${index}`} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="accountFilter" className="block text-sm font-medium mb-1">Filter by Account</label>
          <select
            id="accountFilter"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Accounts</option>
            {Array.isArray(accounts) &&
              accounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="positionTypeFilter" className="block text-sm font-medium mb-1">Position Type</label>
          <select
            id="positionTypeFilter"
            value={positionType}
            onChange={(e) => setPositionType(e.target.value as 'all' | 'common_stock' | 'options' | 'crypto' | 'etf' | 'bond')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="common_stock">Common Stock</option>
            <option value="options">Options</option>
            <option value="crypto">Crypto</option>
            <option value="etf">ETFs</option>
            <option value="bond">Bonds</option>
          </select>
        </div>

        <div>
          <label htmlFor="profitabilityFilter" className="block text-sm font-medium mb-1">Profitability</label>
          <select
            id="profitabilityFilter"
            value={profitabilityFilter}
            onChange={(e) => setProfitabilityFilter(e.target.value as 'all' | 'profitable' | 'losing')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Positions</option>
            <option value="profitable">Profitable Only</option>
            <option value="losing">Losing Only</option>
          </select>
        </div>

        <div className="relative" ref={positionSizeDropdownRef}>
          <label htmlFor="positionSizeFilter" className="block text-sm font-medium mb-1">Position Size</label>
          <div className="relative">
            <select
              id="positionSizeFilter"
              value=""
              onChange={() => {}}
              onFocus={(e) => {
                e.preventDefault();
                setShowPositionSizeDropdown(!showPositionSizeDropdown);
                e.target.blur();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowPositionSizeDropdown(!showPositionSizeDropdown);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              title="Position Size Filter"
            >
              <option value="">
                {(minPositionSize || maxPositionSize) 
                  ? `${minPositionSize ? `$${minPositionSize}` : '0'} - ${maxPositionSize ? `$${maxPositionSize}` : '∞'}`
                  : 'All Sizes'
                }
              </option>
            </select>
          </div>
          
          {showPositionSizeDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg z-10 p-4">
              <div className="space-y-3">
                <div>
                  <label htmlFor="minPositionSizeInput" className="block text-xs font-medium mb-1">Min Size ($)</label>
                  <input
                    id="minPositionSizeInput"
                    type="number"
                    placeholder="e.g. 1000"
                    value={minPositionSize}
                    onChange={(e) => setMinPositionSize(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="maxPositionSizeInput" className="block text-xs font-medium mb-1">Max Size ($)</label>
                  <input
                    id="maxPositionSizeInput"
                    type="number"
                    placeholder="e.g. 50000"
                    value={maxPositionSize}
                    onChange={(e) => setMaxPositionSize(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMinPositionSize('');
                      setMaxPositionSize('');
                    }}
                    className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPositionSizeDropdown(false)}
                    className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters Dropdown */}
        <div className="relative" ref={clearFiltersDropdownRef}>
          <label htmlFor="clearFiltersSelect" className="block text-sm font-medium mb-1">Clear Filters</label>
          <select
            id="clearFiltersSelect"
            value=""
            onChange={() => {}}
            onFocus={(e) => {
              e.preventDefault();
              setShowClearFiltersDropdown(!showClearFiltersDropdown);
              e.target.blur();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowClearFiltersDropdown(!showClearFiltersDropdown);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            title="Clear Filters Options"
          >
            <option value="">All Filters</option>
          </select>
          
          {showClearFiltersDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg z-10 py-2">
              <button
                type="button"
                onClick={() => {
                  setFilter('');
                  setSelectedAccount('all');
                  setPositionType('all');
                  setProfitabilityFilter('all');
                  setMinPositionSize('');
                  setMaxPositionSize('');
                  setShowPositionSizeDropdown(false);
                  setShowClearFiltersDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                title="Clear all filter options"
              >
                All Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter('');
                  setShowClearFiltersDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                title="Clear symbol filter"
              >
                Symbol Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('all');
                  setShowClearFiltersDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                title="Clear account filter"
              >
                Account Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setPositionType('all');
                  setShowClearFiltersDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                title="Clear position type filter"
              >
                Position Type Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfitabilityFilter('all');
                  setShowClearFiltersDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                title="Clear profitability filter"
              >
                Profitability Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMinPositionSize('');
                  setMaxPositionSize('');
                  setShowPositionSizeDropdown(false);
                  setShowClearFiltersDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                title="Clear position size filter"
              >
                Position Size Filter
              </button>
            </div>
          )}
        </div>
      </div>


      <div className="flex flex-col gap-6 w-full">
        {/* Options Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-gray-200 dark:border-zinc-700">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setOptionsExpanded(!optionsExpanded)}
              className="flex items-center gap-3 text-lg font-semibold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowIcon expanded={optionsExpanded} />
              <span>
                Options (Total: ${
                  options.reduce((total, option) => {
                    const units = option.units || 0;
                    const price = option.price || 0;
                    return total + Math.abs(units * price * 100);
                  }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
              type="button"
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
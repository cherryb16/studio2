// src/app/actions/portfolio-analytics.ts


import { AccountHoldingsAccount, Balance } from "snaptrade-typescript-sdk";

// Types for better type safety
export interface Position {
  symbol: {
    symbol: {
      type: { code: string };
      description: string;
      symbol: string;
    };
  };
  units: number;
  price: number;
  open_pnl: number;
  average_purchase_price: number;
}

export interface OptionPosition {
  symbol: {
    option_symbol: {
      ticker: string;
      option_type: 'CALL' | 'PUT';
      strike_price: number;
      expiration_date: string;
      underlying_symbol: {
        symbol: string;
        description: string;
      };
    };
  };
  price: number;
  units: number;
  average_purchase_price: number;
  currency: { code: string };
}

interface HoldingsData {
  account?: any;
  balances?: Balance[] | null;
  positions?: Position[] | null;
  option_positions?: OptionPosition[] | null;
  orders?: any[] | null;
  total_value?: { value: number; currency: string } | null;
}

// ==================== BALANCE CALCULATIONS ====================

export function calculateTotalBalance(holdingsData: HoldingsData): number {
  const cash = calculateCashBalance(holdingsData);
  const equities = calculateEquitiesBalance(holdingsData);
  const options = calculateOptionsBalance(holdingsData.option_positions);
  const crypto = calculateCryptoBalance(holdingsData);
  const other = calculateOtherAssetsBalance(holdingsData);

  console.log('Component balances contributing to total value:');
  console.log('Cash:', cash);
  console.log('Equities:', equities);
  console.log('Options:', options);
  console.log('Crypto:', crypto);
  console.log('Other:', other);

  const total = cash + equities + options + crypto + other;
  console.log('Manually calculated total balance:', total);
  return total;
}

export function calculateCashBalance(holdingsData: HoldingsData): number {
  return holdingsData.balances?.reduce((total, balance) => {
    return total + (balance.cash || 0);
  }, 0) || 0;
}

export function calculateBuyingPower(holdingsData: HoldingsData): number {
  return holdingsData.balances?.reduce((total, balance) => {
    return total + (balance.buying_power || 0);
  }, 0) || 0;
}

// ==================== POSITION VALUE CALCULATIONS ====================

export function calculateEquitiesBalance(input: any): number {
  const positions: any[] = Array.isArray(input) ? input : input.positions ?? [];
  const equityTypes = ['cs', 'et']; // Common Stock, ETF
  
  return positions?.reduce((total, position) => {
    const typeCode = position.symbol?.symbol?.type?.code;
    if (equityTypes.includes(typeCode)) {
      return total + ((position.units || 0) * (position.price || 0));
    }
    return total;
  }, 0) || 0;
}

export function calculateOptionsBalance(options: OptionPosition[] | null | undefined): number {
  if (!Array.isArray(options)) {
    console.warn('Expected options to be an array, got:', options);
    return 0;
  }

  return options.reduce((total, option) => {
    if (!option || !option.units || !option.price) return total;
    return total + Math.abs((option.units || 0) * (option.price || 0) * 100);
  }, 0);
}

export function calculateCryptoBalance(input: any): number {
  const positions: any[] = Array.isArray(input) ? input : input.positions ?? [];
  return positions?.reduce((total, position) => {
    const typeCode = position.symbol?.symbol?.type?.code;
    if (typeCode === 'crypto') {
      return total + ((position.units || 0) * (position.price || 0));
    }
    return total;
  }, 0) || 0;
}

export function calculateOtherAssetsBalance(input: any): number {
  const positions: any[] = Array.isArray(input) ? input : input.positions ?? [];
  const knownTypes = ['cs', 'et', 'crypto']; // Common Stock, ETF, Crypto
  
  return positions?.reduce((total, position) => {
    const typeCode = position.symbol?.symbol?.type?.code;
    if (!knownTypes.includes(typeCode)) {
      return total + ((position.units || 0) * (position.price || 0));
    }
    return total;
  }, 0) || 0;
}

// ==================== PnL CALCULATIONS ====================

export function calculateTotalUnrealizedPnL(holdingsData: HoldingsData): number {
  const equityPnL = holdingsData.positions?.reduce((total, position) => {
    return total + (position.open_pnl || 0);
  }, 0) || 0;

  const optionsPnL = holdingsData.option_positions?.reduce((total, option) => {
    if (!option) return total;
    // Calculate unrealized PnL for options
    const currentValue = (option.units || 0) * (option.price || 0) * 100;
    const costBasis = (option.units || 0) * (option.average_purchase_price || 0) * 100;
    return total + (currentValue - costBasis);
  }, 0) || 0;

  return equityPnL + optionsPnL;
}

export function calculateEquitiesUnrealizedPnL(holdingsData: HoldingsData): number {
  const equityTypes = ['cs', 'et'];
  
  return holdingsData.positions?.reduce((total, position) => {
    const typeCode = position.symbol?.symbol?.type?.code;
    if (equityTypes.includes(typeCode)) {
      return total + (position.open_pnl || 0);
    }
    return total;
  }, 0) || 0;
}

export function calculateOptionsUnrealizedPnL(holdingsData: HoldingsData): number {
  return holdingsData.option_positions?.reduce((total, option) => {
    if (!option) return total;
    const currentValue = (option.units || 0) * (option.price || 0) * 100;
    const costBasis = (option.units || 0) * (option.average_purchase_price || 0) * 100;
    return total + (currentValue - costBasis);
  }, 0) || 0;
}

// ==================== PERCENTAGE CALCULATIONS ====================

export function calculateTotalUnrealizedPnLPercentage(holdingsData: HoldingsData): number {
  const totalValue = calculateTotalBalance(holdingsData);
  const totalPnL = calculateTotalUnrealizedPnL(holdingsData);
  const costBasis = totalValue - totalPnL;
  
  return costBasis !== 0 ? (totalPnL / costBasis) * 100 : 0;
}

export function calculateEquitiesUnrealizedPnLPercentage(holdingsData: HoldingsData): number {
  const equitiesValue = calculateEquitiesBalance(holdingsData);
  const equitiesPnL = calculateEquitiesUnrealizedPnL(holdingsData);
  const costBasis = equitiesValue - equitiesPnL;
  
  return costBasis !== 0 ? (equitiesPnL / costBasis) * 100 : 0;
}

// ==================== PORTFOLIO COMPOSITION ====================

export function calculatePortfolioComposition(holdingsData: HoldingsData) {
  const totalValue = calculateTotalBalance(holdingsData);
  
  if (totalValue === 0) {
    return {
      cash: 0,
      equities: 0,
      options: 0,
      crypto: 0,
      other: 0
    };
  }

  return {
    cash: (calculateCashBalance(holdingsData) / totalValue) * 100,
    equities: (calculateEquitiesBalance(holdingsData) / totalValue) * 100,
    options: (calculateOptionsBalance(holdingsData.option_positions) / totalValue) * 100,
    crypto: (calculateCryptoBalance(holdingsData) / totalValue) * 100,
    other: (calculateOtherAssetsBalance(holdingsData) / totalValue) * 100
  };
}

// ==================== POSITION ANALYTICS ====================

export function getTopPositions(holdingsData: HoldingsData, limit: number = 10) {
  const allPositions = [
    ...(holdingsData.positions || []).map(pos => ({
      symbol: pos.symbol?.symbol?.symbol || 'Unknown',
      description: pos.symbol?.symbol?.description || 'Unknown',
      type: 'equity',
      value: (pos.units || 0) * (pos.price || 0),
      units: pos.units || 0,
      price: pos.price || 0,
      unrealizedPnL: pos.open_pnl || 0,
      unrealizedPnLPercent: pos.average_purchase_price ? 
        ((pos.price || 0) - (pos.average_purchase_price || 0)) / (pos.average_purchase_price || 0) * 100 : 0
    })),
    ...(holdingsData.option_positions || []).map(opt => {
      const units = opt?.units || 0;
      const price = opt?.price || 0;
      const avgPurchasePrice = opt?.average_purchase_price || 0;
      const ticker = opt?.symbol?.option_symbol?.ticker || 'Unknown';
      const underlyingSymbol = opt?.symbol?.option_symbol?.underlying_symbol?.symbol || '';
      const optionType = opt?.symbol?.option_symbol?.option_type || '';
      return {
        symbol: ticker,
        description: `${underlyingSymbol} ${optionType}`,
        type: 'option',
        value: Math.abs(units * price * 100),
        units,
        price,
        unrealizedPnL: (units * price * 100) - (units * avgPurchasePrice * 100),
        unrealizedPnLPercent: avgPurchasePrice ? 
          ((price) - (avgPurchasePrice)) / (avgPurchasePrice) * 100 : 0
      };
    })
  ];

  return allPositions
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function getPositionsByType(holdingsData: HoldingsData) {
  const typeMap: { [key: string]: string } = {
    'cs': 'Common Stock',
    'et': 'ETF',
    'crypto': 'Cryptocurrency',
    'bnd': 'Bond',
    'ps': 'Preferred Stock',
    'oef': 'Open Ended Fund',
    'cef': 'Closed End Fund'
  };

  const positionsByType: { [key: string]: any[] } = {};

  holdingsData.positions?.forEach(position => {
    const typeCode = position.symbol?.symbol?.type?.code || 'unknown';
    const typeName = typeMap[typeCode] || typeCode.toUpperCase();
    
    if (!positionsByType[typeName]) {
      positionsByType[typeName] = [];
    }
    
    positionsByType[typeName].push({
      symbol: position.symbol?.symbol?.symbol,
      description: position.symbol?.symbol?.description,
      value: (position.units || 0) * (position.price || 0),
      units: position.units,
      price: position.price,
      unrealizedPnL: position.open_pnl
    });
  });

  return positionsByType;
}

// ==================== RISK METRICS ====================

export function calculatePositionConcentration(holdingsData: HoldingsData) {
  const totalValue = calculateTotalBalance(holdingsData);
  const positions = getTopPositions(holdingsData, 100);
  
  return {
    top1Concentration: positions.length > 0 ? (positions[0].value / totalValue) * 100 : 0,
    top5Concentration: positions.slice(0, 5).reduce((sum, pos) => sum + pos.value, 0) / totalValue * 100,
    top10Concentration: positions.slice(0, 10).reduce((sum, pos) => sum + pos.value, 0) / totalValue * 100
  };
}

export function calculateDiversificationMetrics(holdingsData: HoldingsData) {
  const positionsByType = getPositionsByType(holdingsData);
  const totalPositions = (holdingsData.positions?.length || 0) + (holdingsData.option_positions?.length || 0);
  
  return {
    totalPositions,
    assetClasses: Object.keys(positionsByType).length,
    averagePositionSize: totalPositions > 0 ? calculateTotalBalance(holdingsData) / totalPositions : 0,
    positionsByType: Object.entries(positionsByType).map(([type, positions]) => ({
      type,
      count: positions.length,
      totalValue: positions.reduce((sum, pos) => sum + pos.value, 0)
    }))
  };
}

// ==================== OPTIONS ANALYTICS ====================

export function calculateOptionsMetrics(holdingsData: HoldingsData) {
  if (!holdingsData.option_positions?.length) {
    return {
      totalContracts: 0,
      callContracts: 0,
      putContracts: 0,
      totalPremium: 0,
      averageTimeToExpiry: 0,
      inTheMoney: 0,
      outOfTheMoney: 0
    };
  }

  const now = new Date();
  let totalTimeToExpiry = 0;
  let inTheMoney = 0;
  let outOfTheMoney = 0;

  const metrics = holdingsData.option_positions.reduce((acc, option) => {
    const contracts = Math.abs(option.units || 0);
    const isCall = option.symbol?.option_symbol?.option_type === 'CALL';
    const strikePrice = option.symbol?.option_symbol?.strike_price || 0;
    const expiryDate = new Date(option.symbol?.option_symbol?.expiration_date || '');
    
    // Time to expiry in days
    const timeToExpiry = Math.max(0, (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    totalTimeToExpiry += timeToExpiry * contracts;
    
    // ITM/OTM calculation would need underlying price, skipping for now
    
    return {
      totalContracts: acc.totalContracts + contracts,
      callContracts: acc.callContracts + (isCall ? contracts : 0),
      putContracts: acc.putContracts + (!isCall ? contracts : 0),
      totalPremium: acc.totalPremium + (contracts * (option.price || 0) * 100)
    };
  }, {
    totalContracts: 0,
    callContracts: 0,
    putContracts: 0,
    totalPremium: 0
  });

  return {
    ...metrics,
    averageTimeToExpiry: metrics.totalContracts > 0 ? totalTimeToExpiry / metrics.totalContracts : 0,
    inTheMoney,
    outOfTheMoney
  };
}

// ==================== COMPREHENSIVE PORTFOLIO SUMMARY ====================

export function generatePortfolioSummary(holdingsData: HoldingsData) {
  return {
    totalBalance: calculateTotalBalance(holdingsData),
    cashBalance: calculateCashBalance(holdingsData),
    buyingPower: calculateBuyingPower(holdingsData),
    
    assetBalances: {
      equities: calculateEquitiesBalance(holdingsData.positions),
      options: calculateOptionsBalance(holdingsData.option_positions),
      crypto: calculateCryptoBalance(holdingsData.positions),
      other: calculateOtherAssetsBalance(holdingsData.positions)
    },
    
    unrealizedPnL: {
      total: calculateTotalUnrealizedPnL(holdingsData),
      totalPercentage: calculateTotalUnrealizedPnLPercentage(holdingsData),
      equities: calculateEquitiesUnrealizedPnL(holdingsData),
      equitiesPercentage: calculateEquitiesUnrealizedPnLPercentage(holdingsData),
      options: calculateOptionsUnrealizedPnL(holdingsData)
    },
    
    composition: calculatePortfolioComposition(holdingsData),
    concentration: calculatePositionConcentration(holdingsData),
    diversification: calculateDiversificationMetrics(holdingsData),
    optionsMetrics: calculateOptionsMetrics(holdingsData),
    
    topPositions: getTopPositions(holdingsData, 10)
  };
}
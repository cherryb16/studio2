// Unified Market Data Provider - Disabled (Market data APIs removed to avoid costs)

// Unified interface for market data (now returns null/empty data)
export interface UnifiedQuote {
  symbol: string;
  shortName: string;
  longName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketTime: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
  beta?: number;
  exchange?: string;
  currency?: string;
  dataSource: 'Disabled';
}

// Stub function - returns null as market data APIs have been removed
export async function getUnifiedQuote(symbol: string): Promise<UnifiedQuote | null> {
  console.warn(`Market data APIs disabled - cannot fetch quote for ${symbol}`);
  return null;
}

// Stub function - returns empty map as market data APIs have been removed
export async function getMultipleUnifiedQuotes(symbols: string[]): Promise<Map<string, UnifiedQuote>> {
  console.warn(`Market data APIs disabled - cannot fetch quotes for ${symbols.length} symbols`);
  return new Map();
}

// Get data source statistics for monitoring (always returns zeros now)
export function getDataSourceStats(quotes: Map<string, UnifiedQuote>): {
  total: number;
  twelveData: number;
  yahoo: number;
  coverage: number;
} {
  return {
    total: 0,
    twelveData: 0,
    yahoo: 0,
    coverage: 0
  };
}

// Stub exports for backward compatibility
export const getTwelveDataQuote = async (symbol: string) => {
  console.warn(`Twelve Data API disabled - cannot fetch quote for ${symbol}`);
  return null;
};

export const getYahooQuote = async (symbol: string) => {
  console.warn(`Yahoo Finance API disabled - cannot fetch quote for ${symbol}`);
  return null;
};

// Legacy type export for compatibility
export interface YahooQuote {
  symbol: string;
  shortName: string;
  longName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketTime: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
  beta?: number;
  exchange?: string;
  currency?: string;
}
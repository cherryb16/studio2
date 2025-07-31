// src/app/actions/yahoo-finance.ts
'use server';

interface YahooQuote {
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
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  marketCap: number;
  trailingPE: number;
  forwardPE: number;
  dividendYield: number;
  beta: number;
}

interface YahooHistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance';

export async function getQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const response = await fetch(
      `${YAHOO_FINANCE_API}/quote?symbols=${encodeURIComponent(symbol)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      console.error('Yahoo Finance API error:', response.statusText);
      return null;
    }

    const data = await response.json();
    const quote = data.quoteResponse?.result?.[0];

    if (!quote) {
      return null;
    }

    return {
      symbol: quote.symbol,
      shortName: quote.shortName || quote.symbol,
      longName: quote.longName || quote.shortName || quote.symbol,
      regularMarketPrice: quote.regularMarketPrice,
      regularMarketChange: quote.regularMarketChange,
      regularMarketChangePercent: quote.regularMarketChangePercent,
      regularMarketTime: quote.regularMarketTime,
      regularMarketDayHigh: quote.regularMarketDayHigh,
      regularMarketDayLow: quote.regularMarketDayLow,
      regularMarketVolume: quote.regularMarketVolume,
      regularMarketPreviousClose: quote.regularMarketPreviousClose,
      regularMarketOpen: quote.regularMarketOpen,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      marketCap: quote.marketCap,
      trailingPE: quote.trailingPE,
      forwardPE: quote.forwardPE,
      dividendYield: quote.dividendYield,
      beta: quote.beta,
    };
  } catch (error) {
    console.error('Error fetching Yahoo Finance quote:', error);
    return null;
  }
}

export async function getMultipleQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const quotes = new Map<string, YahooQuote>();
  
  try {
    const symbolsParam = symbols.join(',');
    const response = await fetch(
      `${YAHOO_FINANCE_API}/quote?symbols=${encodeURIComponent(symbolsParam)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      console.error('Yahoo Finance API error:', response.statusText);
      return quotes;
    }

    const data = await response.json();
    const results = data.quoteResponse?.result || [];

    for (const quote of results) {
      quotes.set(quote.symbol, {
        symbol: quote.symbol,
        shortName: quote.shortName || quote.symbol,
        longName: quote.longName || quote.shortName || quote.symbol,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChange: quote.regularMarketChange,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        regularMarketTime: quote.regularMarketTime,
        regularMarketDayHigh: quote.regularMarketDayHigh,
        regularMarketDayLow: quote.regularMarketDayLow,
        regularMarketVolume: quote.regularMarketVolume,
        regularMarketPreviousClose: quote.regularMarketPreviousClose,
        regularMarketOpen: quote.regularMarketOpen,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        marketCap: quote.marketCap,
        trailingPE: quote.trailingPE,
        forwardPE: quote.forwardPE,
        dividendYield: quote.dividendYield,
        beta: quote.beta,
      });
    }
  } catch (error) {
    console.error('Error fetching Yahoo Finance quotes:', error);
  }

  return quotes;
}

export async function getHistoricalData(
  symbol: string,
  period1: Date,
  period2: Date = new Date(),
  interval: '1d' | '1wk' | '1mo' = '1d'
): Promise<YahooHistoricalData[]> {
  try {
    const p1 = Math.floor(period1.getTime() / 1000);
    const p2 = Math.floor(period2.getTime() / 1000);
    
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=${interval}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      console.error('Yahoo Finance API error:', response.statusText);
      return [];
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      return [];
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];

    const historicalData: YahooHistoricalData[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open?.[i] != null) {
        historicalData.push({
          date: new Date(timestamps[i] * 1000),
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
          volume: quotes.volume[i],
          adjustedClose: adjClose[i] || quotes.close[i],
        });
      }
    }

    return historicalData;
  } catch (error) {
    console.error('Error fetching Yahoo Finance historical data:', error);
    return [];
  }
}

// Get sector and industry information
export async function getSymbolProfile(symbol: string) {
  try {
    // Using a different endpoint that might provide sector info
    const response = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,summaryProfile`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const profile = data.quoteSummary?.result?.[0]?.assetProfile || 
                   data.quoteSummary?.result?.[0]?.summaryProfile;

    if (!profile) {
      return null;
    }

    return {
      sector: profile.sector,
      industry: profile.industry,
      website: profile.website,
      description: profile.longBusinessSummary,
      employees: profile.fullTimeEmployees,
      country: profile.country,
      city: profile.city,
    };
  } catch (error) {
    console.error('Error fetching symbol profile:', error);
    return null;
  }
}

// Calculate real-time performance metrics
export async function calculatePerformanceMetrics(
  symbols: string[],
  holdings: Map<string, { units: number; averagePrice: number }>
) {
  const quotes = await getMultipleQuotes(symbols);
  const metrics = {
    totalValue: 0,
    totalCost: 0,
    totalUnrealizedPnL: 0,
    topGainers: [] as Array<{ symbol: string; percentGain: number; dollarGain: number }>,
    topLosers: [] as Array<{ symbol: string; percentLoss: number; dollarLoss: number }>,
  };

  for (const [symbol, holding] of holdings) {
    const quote = quotes.get(symbol);
    if (!quote) continue;

    const currentValue = quote.regularMarketPrice * holding.units;
    const costBasis = holding.averagePrice * holding.units;
    const unrealizedPnL = currentValue - costBasis;
    const percentChange = ((currentValue - costBasis) / costBasis) * 100;

    metrics.totalValue += currentValue;
    metrics.totalCost += costBasis;
    metrics.totalUnrealizedPnL += unrealizedPnL;

    if (percentChange > 0) {
      metrics.topGainers.push({
        symbol,
        percentGain: percentChange,
        dollarGain: unrealizedPnL,
      });
    } else if (percentChange < 0) {
      metrics.topLosers.push({
        symbol,
        percentLoss: Math.abs(percentChange),
        dollarLoss: Math.abs(unrealizedPnL),
      });
    }
  }

  // Sort and limit results
  metrics.topGainers.sort((a, b) => b.percentGain - a.percentGain);
  metrics.topLosers.sort((a, b) => b.percentLoss - a.percentLoss);
  metrics.topGainers = metrics.topGainers.slice(0, 5);
  metrics.topLosers = metrics.topLosers.slice(0, 5);

  return metrics;
}
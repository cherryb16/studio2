// Alternative market data provider - Alpha Vantage
// Free tier: 25 requests per day, 5 calls per minute
// You need to get a free API key from https://www.alphavantage.co/support/#api-key

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

export interface AlphaVantageQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
}

export async function getAlphaVantageQuote(symbol: string): Promise<AlphaVantageQuote | null> {
  try {
    const response = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );

    if (!response.ok) {
      console.error('Alpha Vantage API error:', response.statusText);
      return null;
    }

    const data = await response.json();
    const quote = data['Global Quote'];

    if (!quote || Object.keys(quote).length === 0) {
      console.error('No data returned from Alpha Vantage for symbol:', symbol);
      return null;
    }

    return {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      volume: parseInt(quote['06. volume']),
      previousClose: parseFloat(quote['08. previous close'])
    };
  } catch (error) {
    console.error('Error fetching Alpha Vantage quote:', error);
    return null;
  }
}

export async function getMultipleAlphaVantageQuotes(symbols: string[]): Promise<Map<string, AlphaVantageQuote>> {
  const quotes = new Map<string, AlphaVantageQuote>();
  
  // Alpha Vantage free tier has rate limits, so we need to be careful
  for (const symbol of symbols.slice(0, 5)) { // Limit to 5 symbols to avoid rate limits
    const quote = await getAlphaVantageQuote(symbol);
    if (quote) {
      quotes.set(symbol, quote);
    }
    // Add delay to respect rate limits (5 calls per minute = 12 seconds between calls)
    await new Promise(resolve => setTimeout(resolve, 12000));
  }

  return quotes;
}
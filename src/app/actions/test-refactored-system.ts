// src/app/actions/test-refactored-system.ts
'use server';

// Test file to verify the refactored system works correctly
import { generatePortfolioSummary, type HoldingsData } from './core/portfolio-calculations';
// ESG, sector, and dividend data sources removed

// Test with mock data
export async function testRefactoredSystem() {
  try {
    console.log('Testing refactored portfolio system...');
    
    // Mock holdings data
    const mockHoldings: HoldingsData = {
      account: { id: 'test-account' },
      balances: [
        { cash: 5000, buying_power: 10000, currency: { code: 'USD', name: 'USD', id: 'USD' } }
      ],
      positions: [
        {
          symbol: {
            symbol: {
              type: { code: 'cs' },
              description: 'Apple Inc.',
              symbol: 'AAPL'
            }
          },
          units: 10,
          price: 150,
          open_pnl: 200,
          average_purchase_price: 130
        },
        {
          symbol: {
            symbol: {
              type: { code: 'cs' },
              description: 'Microsoft Corporation',
              symbol: 'MSFT'
            }
          },
          units: 5,
          price: 300,
          open_pnl: 100,
          average_purchase_price: 280
        }
      ],
      option_positions: [],
      orders: [],
      total_value: { value: 6500, currency: 'USD' }
    };

    // Test core portfolio calculations
    console.log('1. Testing core portfolio calculations...');
    const portfolioSummary = generatePortfolioSummary(mockHoldings);
    console.log('Portfolio summary generated:', {
      totalBalance: portfolioSummary.totalBalance,
      positions: portfolioSummary.topPositions.length
    });

    // External data sources disabled
    console.log('2. External data sources disabled (ESG, sector, dividend APIs removed)');
    
    console.log('3. Testing basic portfolio calculations only...');

    return {
      success: true,
      results: {
        portfolioSummary: {
          totalBalance: portfolioSummary.totalBalance,
          positions: portfolioSummary.topPositions.length,
          cashBalance: portfolioSummary.cashBalance
        },
        externalData: {
          sectorsRetrieved: sectorData.size,
          dividendDataPoints: dividendData.size,
          esgScores: esgData.size
        },
        riskAnalysis: {
          sectorsAnalyzed: sectorAnalysis.length,
          annualDividends: dividendAnalysis.totalAnnualDividends,
          esgRating: esgAnalysis.esgRating,
          esgScore: esgAnalysis.portfolioESGScores.overall
        }
      },
      message: 'Refactored system test completed successfully'
    };

  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Refactored system test failed'
    };
  }
}
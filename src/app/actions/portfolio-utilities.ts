// Import required functions
import { getPortfolioAnalytics } from './snaptrade-enhanced';
import { 
  getUserHoldings,
  getSnapTradeCredentials,
  getSnapTradeAccounts 
} from './snaptrade';
import {
  generatePortfolioSummary,
  calculateTotalBalance,
  calculateCashBalance,
  calculateTotalUnrealizedPnL,
  calculatePortfolioComposition,
  getTopPositions
} from './portfolio-analytics';
import {
  analyzeSectorAllocation,
  calculateDividendMetrics,
  analyzeTaxLossHarvesting,
  analyzePositionSizing,
  analyzePortfolioCorrelation,
  analyzePerformanceAttribution,
  analyzeESGExposure,
  generateRiskDashboard
} from './advanced-analytics';
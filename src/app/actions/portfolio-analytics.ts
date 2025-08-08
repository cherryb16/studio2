// src/app/actions/portfolio-analytics.ts
// Re-export from new core module for backwards compatibility

export {
  type Position,
  type OptionPosition,
  type HoldingsData,
  calculateTotalBalance,
  calculateCashBalance,
  calculateBuyingPower,
  calculateEquitiesBalance,
  calculateOptionsBalance,
  calculateCryptoBalance,
  calculateOtherAssetsBalance,
  calculateTotalUnrealizedPnL,
  calculateEquitiesUnrealizedPnL,
  calculateOptionsUnrealizedPnL,
  calculateTotalUnrealizedPnLPercentage,
  calculateEquitiesUnrealizedPnLPercentage,
  calculateTotalReturn,
  calculatePortfolioComposition,
  getTopPositions,
  getPositionsByType,
  calculatePositionConcentration,
  calculateDiversificationMetrics,
  calculateOptionsMetrics,
  generatePortfolioSummary
} from './core/portfolio-calculations';
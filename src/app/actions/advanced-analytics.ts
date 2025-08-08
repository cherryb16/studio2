// src/app/actions/advanced-analytics.ts
'use server';

import { generateRiskDashboard as generateRiskDashboardImpl } from './orchestration/risk-dashboard';

// Wrapper for backwards compatibility in server actions
export async function generateRiskDashboard(
  snaptradeUserId: string, 
  userSecret: string,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
) {
  return await generateRiskDashboardImpl(snaptradeUserId, userSecret, riskTolerance);
}
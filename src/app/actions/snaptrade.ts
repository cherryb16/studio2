// src/app/actions/snaptrade.ts
'use server';

import {
  getSnapTradeLoginUrl as getSnapTradeLoginUrlImpl,
  getSnapTradeCredentials as getSnapTradeCredentialsImpl,
  getSnapTradeAccounts as getSnapTradeAccountsImpl,
  getSnapTradeBalances as getSnapTradeBalancesImpl
} from './data-sources/snaptrade/accounts';

import {
  getSnapTradePositions as getSnapTradePositionsImpl,
  getUserHoldings as getUserHoldingsImpl,
  getAllPositions as getAllPositionsImpl
} from './data-sources/snaptrade/positions';

// Wrapper functions for backwards compatibility in server actions
export async function getSnapTradeLoginUrl(firebaseUserId: string, redirectUrl?: string) {
  return await getSnapTradeLoginUrlImpl(firebaseUserId, redirectUrl);
}

export async function getSnapTradeCredentials(firebaseUserId: string) {
  return await getSnapTradeCredentialsImpl(firebaseUserId);
}

export async function getSnapTradeAccounts(snaptradeUserId: string, userSecret: string) {
  return await getSnapTradeAccountsImpl(snaptradeUserId, userSecret);
}

export async function getSnapTradeBalances(
  snaptradeUserId: string, 
  userSecret: string, 
  accountId?: string
) {
  return await getSnapTradeBalancesImpl(snaptradeUserId, userSecret, accountId);
}

export async function getSnapTradePositions(
  snaptradeUserId: string, 
  userSecret: string, 
  accountId?: string
) {
  return await getSnapTradePositionsImpl(snaptradeUserId, userSecret, accountId);
}

export async function getUserHoldings(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
) {
  return await getUserHoldingsImpl(snaptradeUserId, userSecret, accountId);
}

export async function getAllPositions(
  snaptradeUserId: string, 
  userSecret: string, 
  accountId?: string
) {
  return await getAllPositionsImpl(snaptradeUserId, userSecret, accountId);
}
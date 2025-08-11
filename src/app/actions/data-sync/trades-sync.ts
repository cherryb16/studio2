// src/app/actions/data-sync/trades-sync.ts
'use server';

import {
  Account,
  Position,
  UniversalActivity,
} from 'snaptrade-typescript-sdk';
import { snaptrade } from '@/app/actions/data-sources/snaptrade/client';
import { db } from '@/lib/firebase-admin';
import { getSnapTradeAccounts } from '@/app/actions/data-sources/snaptrade/accounts';
import { WriteBatch } from 'firebase-admin/firestore';

/**
 * Main function to sync all trades, positions, and activities for a user.
 * It fetches all accounts and then syncs data for each one.
 */
export async function syncUserTrades(
  firebaseUserId: string,
  snaptradeUserId: string,
  userSecret: string,
  isFullSync: boolean = false
) {
  console.log(`Starting trade sync for user: ${firebaseUserId}. Full sync: ${isFullSync}`);
  
  const accounts = await getSnapTradeAccounts(snaptradeUserId, userSecret);

  if ('error' in accounts) {
    console.error('Failed to fetch accounts:', accounts.error);
    return { success: false, error: accounts.error };
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    console.log('User has no accounts to sync.');
    return { success: true, message: 'No accounts to sync.' };
  }
  
  const results = [];

  for (const account of accounts) {
    try {
      // Create a new batch for each account to avoid exceeding batch size limits.
      const batch = db.batch();
      
      console.log(`Syncing data for account: ${account.id} (${account.name})`);

      // Sync account metadata first
      await syncAccountMetadata(firebaseUserId, account, batch);
      
      // Sync activities, positions, etc., for the account
      await syncActivitiesForAccount(snaptradeUserId, userSecret, account, firebaseUserId, batch, isFullSync);
      await syncPositionsForAccount(snaptradeUserId, userSecret, account, firebaseUserId, batch);
      
      // Commit all the writes for this account in one go.
      await batch.commit();
      
      results.push({
        accountId: account.id,
        success: true,
        message: `Successfully synced account ${account.name}.`
      });

    } catch (error: any) {
      console.error(`Error syncing account ${account.id} for user ${firebaseUserId}:`, error);
      results.push({
        accountId: account.id,
        success: false,
        error: error.message
      });
    }
  }

  return { success: true, results };
}

/**
 * Saves or updates the metadata for a specific brokerage account.
 */
async function syncAccountMetadata(firebaseUserId: string, account: Account, batch: WriteBatch) {
    const accountRef = db
        .collection('snaptrade_users').doc(firebaseUserId)
        .collection('accounts').doc(account.id);

    const metadata = {
        id: account.id,
        brokerage: account.brokerage?.name,
        accountName: account.name,
        accountNumber: account.number,
        baseCurrency: account.currency?.code,
        createdAt: account.meta?.created_date,
        lastActivitySyncAt: new Date(), // Update sync time
    };
    
    batch.set(accountRef, { meta: metadata }, { merge: true });
}


/**
 * Fetches and syncs all activities (trades) for a given account.
 */
async function syncActivitiesForAccount(
  snaptradeUserId: string,
  userSecret: string,
  account: Account,
  firebaseUserId: string,
  batch: WriteBatch,
  isFullSync: boolean
) {
  // Define the date range for fetching activities
  const endDate = new Date();
  const startDate = new Date();
  if (isFullSync) {
    startDate.setFullYear(endDate.getFullYear() - 10); // Fetch up to 10 years for a full sync
  } else {
    startDate.setDate(endDate.getDate() - 90); // Fetch last 90 days for an incremental sync
  }

  // Corrected: Used 'transactionsAndReporting' API which contains the 'getActivities' method
  const activitiesResponse = await snaptrade.transactionsAndReporting.getActivities({
    userId: snaptradeUserId,
    userSecret: userSecret,
    accounts: account.id,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });

  const activities: UniversalActivity[] = activitiesResponse.data;
  console.log(`Found ${activities.length} activities for account ${account.id}.`);

  for (const activity of activities) {
    // Correctly reference the nested 'activities' subcollection
    const activityRef = db
      .collection('snaptrade_users').doc(firebaseUserId)
      .collection('accounts').doc(account.id)
      .collection('activities').doc(activity.id);

    // Add the set operation to the batch
    batch.set(activityRef, { ...activity, updatedAt: new Date() });
  }
}

/**
 * Fetches and syncs all positions for a given account.
 */
async function syncPositionsForAccount(
  snaptradeUserId: string,
  userSecret: string,
  account: Account,
  firebaseUserId: string,
  batch: WriteBatch
) {
  const positionsResponse = await snaptrade.accountInformation.getUserHoldings({
    userId: snaptradeUserId,
    userSecret: userSecret,
    accountId: account.id,
  });

  const positions = positionsResponse.data.positions;
  if (!positions || !Array.isArray(positions)) {
      console.log(`No positions array found for account ${account.id}.`);
      return;
  }
  
  console.log(`Found ${positions.length} positions for account ${account.id}.`);

  for (const position of positions) {
    // Corrected: Added a null check for position.symbol to prevent runtime errors.
    if (position.symbol) {
        let positionRef;
        let positionData: Position & { updatedAt: Date };

        // Determine if it's an equity or an option and set the reference accordingly
        if (position.symbol.symbol_type === 'OPTION') {
          positionRef = db
            .collection('snaptrade_users').doc(firebaseUserId)
            .collection('accounts').doc(account.id)
            .collection('positions_options').doc(position.symbol.id); // Use OCC Ticker for ID
        } else {
          positionRef = db
            .collection('snaptrade_users').doc(firebaseUserId)
            .collection('accounts').doc(account.id)
            .collection('positions_equities').doc(position.symbol.id); // Use Symbol for ID
        }
        
        positionData = { ...position, updatedAt: new Date() };
        
        // Add the set operation to the batch
        batch.set(positionRef, positionData, { merge: true });
    }
  }
}

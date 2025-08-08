import * as functions from 'firebase-functions';
import { syncUserTrades } from '../app/actions/data-sync/trades-sync';
import { getSnapTradeCredentials } from '../app/actions/firebase-admin';

export const syncTrades = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    try {
      // Get all users with SnapTrade credentials
      const users = await getSnapTradeCredentials();
      
      for (const user of users) {
        try {
          await syncUserTrades(
            user.firebaseUserId,
            user.snaptradeUserId,
            user.userSecret,
            false // Incremental sync
          );
        } catch (error) {
          console.error(`Error syncing trades for user ${user.firebaseUserId}:`, error);
          // Continue with next user
        }
      }
    } catch (error) {
      console.error('Error in syncTrades function:', error);
    }
  });

// Force a full sync for a specific user
export const forceSyncTrades = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to sync trades.'
    );
  }

  try {
    const credentials = await getSnapTradeCredentials(context.auth.uid);
    if (!credentials) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No SnapTrade credentials found.'
      );
    }

    const result = await syncUserTrades(
      context.auth.uid,
      credentials.snaptradeUserId,
      credentials.userSecret,
      true // Full sync
    );

    return result;
  } catch (error: any) {
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Error syncing trades.'
    );
  }
});

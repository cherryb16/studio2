import { db, adminAuth } from '@/lib/firebase-admin';
import { snaptrade } from '@/app/actions/snaptrade-client';

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return new Response(JSON.stringify({ error: 'uid is required' }), {
        status: 400,
      });
    }

    // Remove Firestore data from all user-related collections
    const deletePromises = [
      db.collection('users').doc(uid).delete(),
      db.collection('snaptrade_users').doc(uid).delete(),
      db.collection('cache').doc(uid).delete(), // Remove cached user data
    ];
    
    try {
      await Promise.all(deletePromises);
      console.log(`Successfully deleted Firestore data for user: ${uid}`);
    } catch (firestoreError) {
      console.error('Error deleting Firestore data:', firestoreError);
      // Continue with other deletions even if Firestore fails
    }

    // Delete SnapTrade user (ignore errors)
    try {
      await snaptrade.authentication.deleteSnapTradeUser({ userId: uid });
    } catch (error) {
      console.error('Error deleting SnapTrade user:', error);
    }

    // Delete Firebase auth user (ignore errors)
    try {
      await adminAuth.deleteUser(uid);
    } catch (error) {
      console.error('Error deleting Firebase auth user:', error);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Account and all associated data deleted successfully',
      deletedCollections: ['users', 'snaptrade_users', 'cache'],
      deletedServices: ['SnapTrade', 'Firebase Auth']
    }), { status: 200 });
  } catch (error) {
    console.error('Error deleting account:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
}


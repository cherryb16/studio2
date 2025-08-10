// Comprehensive user deletion service - removes ALL user data from Firestore

import { getDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from './firestore-schema';

export interface DeletionReport {
  userId: string;
  deletedCollections: {
    trades: number;
    positions_options: number;
    positions_equities: number;
    metrics: number;
    information: number;
  };
  totalDocuments: number;
  success: boolean;
  error?: string;
}

export class UserDeletionService {
  
  static async deleteAllUserData(userId: string): Promise<DeletionReport> {
    const adminDb = getDb();
    const report: DeletionReport = {
      userId,
      deletedCollections: {
        trades: 0,
        positions_options: 0,
        positions_equities: 0,
        metrics: 0,
        information: 0
      },
      totalDocuments: 0,
      success: false
    };

    try {
      console.log(`Starting complete deletion for user: ${userId}`);

      // Delete all subcollections under the user
      const collections = [
        { name: COLLECTIONS.TRADES, reportKey: 'trades' },
        { name: COLLECTIONS.POSITIONS_OPTIONS, reportKey: 'positions_options' },
        { name: COLLECTIONS.POSITIONS_EQUITIES, reportKey: 'positions_equities' },
        { name: COLLECTIONS.METRICS, reportKey: 'metrics' },
        { name: COLLECTIONS.INFORMATION, reportKey: 'information' }
      ];

      // Delete each subcollection
      for (const collection of collections) {
        const deletedCount = await this.deleteCollection(
          adminDb,
          `snaptrade_users/${userId}/${collection.name}`,
          userId
        );
        (report.deletedCollections as any)[collection.reportKey] = deletedCount;
        report.totalDocuments += deletedCount;
        console.log(`Deleted ${deletedCount} documents from ${collection.name}`);
      }

      // Delete the main user document
      await adminDb.collection(COLLECTIONS.SNAPTRADE_USERS).doc(userId).delete();
      report.totalDocuments += 1;
      console.log(`Deleted main user document: ${userId}`);

      // Also delete from legacy collections if they exist
      await this.deleteLegacyUserData(adminDb, userId, report);

      // Delete from other user-related collections
      await this.deleteOtherUserCollections(adminDb, userId, report);

      report.success = true;
      console.log(`User deletion completed: ${report.totalDocuments} total documents deleted`);
      
      return report;

    } catch (error) {
      console.error(`User deletion failed for ${userId}:`, error);
      report.error = error instanceof Error ? error.message : 'Unknown error';
      return report;
    }
  }

  private static async deleteCollection(
    adminDb: any, 
    collectionPath: string, 
    userId: string
  ): Promise<number> {
    const collectionRef = adminDb.collection(collectionPath);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      return 0;
    }

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deletedCount = 0;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);
      
      batchDocs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deletedCount += batchDocs.length;
    }

    return deletedCount;
  }

  private static async deleteLegacyUserData(
    adminDb: any, 
    userId: string, 
    report: DeletionReport
  ): Promise<void> {
    console.log(`Cleaning up legacy data for user: ${userId}`);

    // Delete from old flat collections if they exist
    const legacyCollections = [
      'positions',
      'trades', 
      'portfolio_summaries',
      'user_metrics',
      'daily_snapshots'
    ];

    for (const collectionName of legacyCollections) {
      try {
        // Query documents belonging to this user
        const userDocsQuery = adminDb.collection(collectionName).where('userId', '==', userId);
        const snapshot = await userDocsQuery.get();
        
        if (!snapshot.empty) {
          const batch = adminDb.batch();
          snapshot.docs.forEach((doc: any) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          
          report.totalDocuments += snapshot.docs.length;
          console.log(`Deleted ${snapshot.docs.length} legacy documents from ${collectionName}`);
        }
      } catch (error) {
        console.log(`No legacy collection ${collectionName} or no documents found`);
      }
    }
  }

  private static async deleteOtherUserCollections(
    adminDb: any, 
    userId: string, 
    report: DeletionReport
  ): Promise<void> {
    console.log(`Deleting other user collections for: ${userId}`);

    // Delete from users collection
    try {
      await adminDb.collection('users').doc(userId).delete();
      report.totalDocuments += 1;
      console.log(`Deleted user profile document`);
    } catch (error) {
      console.log(`No user profile document found`);
    }

    // Delete Stripe customer data
    try {
      const customerRef = adminDb.collection('customers').doc(userId);
      const customerDoc = await customerRef.get();
      
      if (customerDoc.exists) {
        // Delete subcollections first
        const subcollections = ['checkout_sessions', 'subscriptions', 'payments'];
        for (const subcollection of subcollections) {
          const subSnapshot = await customerRef.collection(subcollection).get();
          if (!subSnapshot.empty) {
            const batch = adminDb.batch();
            subSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
            await batch.commit();
            report.totalDocuments += subSnapshot.docs.length;
          }
        }
        
        // Delete main customer document
        await customerRef.delete();
        report.totalDocuments += 1;
        console.log(`Deleted Stripe customer data`);
      }
    } catch (error) {
      console.log(`No Stripe customer data found`);
    }
  }

  // Soft delete - mark user as deleted but keep data for recovery
  static async softDeleteUser(userId: string): Promise<void> {
    const adminDb = getDb();
    
    // Mark user as deleted in main document
    await adminDb.collection(COLLECTIONS.SNAPTRADE_USERS).doc(userId).update({
      deleted: true,
      deletedAt: new Date(),
      status: 'deleted'
    });

    // Mark user as deleted in users collection
    try {
      await adminDb.collection('users').doc(userId).update({
        deleted: true,
        deletedAt: new Date(),
        status: 'deleted'
      });
    } catch (error) {
      console.log('No user document to soft delete');
    }

    console.log(`Soft deleted user: ${userId}`);
  }

  // Restore soft-deleted user
  static async restoreUser(userId: string): Promise<void> {
    const adminDb = getDb();
    
    // Remove deletion markers
    await adminDb.collection(COLLECTIONS.SNAPTRADE_USERS).doc(userId).update({
      deleted: false,
      deletedAt: null,
      status: 'active',
      restoredAt: new Date()
    });

    try {
      await adminDb.collection('users').doc(userId).update({
        deleted: false,
        deletedAt: null,
        status: 'active',
        restoredAt: new Date()
      });
    } catch (error) {
      console.log('No user document to restore');
    }

    console.log(`Restored user: ${userId}`);
  }
}

// ==================== API INTEGRATION ====================

export async function serverDeleteUser(userId: string): Promise<DeletionReport> {
  'use server';
  return await UserDeletionService.deleteAllUserData(userId);
}

export async function serverSoftDeleteUser(userId: string): Promise<void> {
  'use server';
  return await UserDeletionService.softDeleteUser(userId);
}

export async function serverRestoreUser(userId: string): Promise<void> {
  'use server';
  return await UserDeletionService.restoreUser(userId);
}
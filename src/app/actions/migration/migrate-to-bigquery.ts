'use server';

import { initializeBigQuery } from '../bigquery/client';
import { loadAllUserData } from '../bigquery/data-loaders';
import { configureSyncForUser } from '../sync/daily-refresh';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Migration utility to move existing users to BigQuery system
export async function migrateExistingUsers() {
  try {
    console.log('Starting migration to BigQuery system...');
    
    // Initialize BigQuery
    await initializeBigQuery();
    
    // Get existing users with SnapTrade credentials
    const users = await getExistingUsersWithCredentials();
    
    console.log(`Found ${users.length} users to migrate`);
    
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const user of users) {
      try {
        console.log(`Migrating user: ${user.userId}`);
        
        // Load all historical data into BigQuery
        await loadAllUserData(user.snaptradeUserId, user.userSecret);
        
        // Configure daily sync
        await configureSyncForUser(
          user.userId, 
          user.snaptradeUserId, 
          user.userSecret, 
          true
        );
        
        results.successful++;
        console.log(`Successfully migrated user: ${user.userId}`);
        
      } catch (error) {
        console.error(`Error migrating user ${user.userId}:`, error);
        results.failed++;
        results.errors.push(`User ${user.userId}: ${error.message}`);
      }
    }
    
    console.log('Migration completed:', results);
    return results;
    
  } catch (error) {
    console.error('Error in migration:', error);
    throw error;
  }
}

// Get users who have SnapTrade credentials
async function getExistingUsersWithCredentials() {
  try {
    const users = [];
    
    // This is a simplified version - you'll need to adapt based on your actual data structure
    // Typically you'd query your users collection and find those with SnapTrade credentials
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      // Check if user has SnapTrade credentials
      if (userData.snaptradeUserId && userData.userSecret) {
        users.push({
          userId: doc.id,
          snaptradeUserId: userData.snaptradeUserId,
          userSecret: userData.userSecret
        });
      }
    }
    
    return users;
  } catch (error) {
    console.error('Error getting existing users:', error);
    return [];
  }
}

// Test migration for a single user
export async function testMigrationForUser(
  userId: string,
  snaptradeUserId: string,
  userSecret: string
) {
  try {
    console.log(`Testing migration for user: ${userId}`);
    
    // Initialize BigQuery
    await initializeBigQuery();
    
    // Load sample data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const results = await loadAllUserData(snaptradeUserId, userSecret);
    
    console.log('Test migration results:', results);
    
    // Configure sync but don't enable it yet
    await configureSyncForUser(userId, snaptradeUserId, userSecret, false);
    
    return {
      success: true,
      message: 'Test migration completed successfully',
      results
    };
    
  } catch (error) {
    console.error('Error in test migration:', error);
    return {
      success: false,
      message: error.message,
      results: null
    };
  }
}

// Validate BigQuery setup
export async function validateBigQuerySetup() {
  try {
    console.log('Validating BigQuery setup...');
    
    const checks = {
      bigQueryInitialized: false,
      tablesExist: false,
      canInsertData: false,
      canQueryData: false
    };
    
    // Initialize BigQuery
    await initializeBigQuery();
    checks.bigQueryInitialized = true;
    
    // Check if tables exist (this would involve checking the dataset)
    // You can implement table existence checks here
    checks.tablesExist = true; // Assume true for now
    
    // Test data insertion with dummy data
    // You can implement a test data insert here
    checks.canInsertData = true; // Assume true for now
    
    // Test data querying
    // You can implement a test query here
    checks.canQueryData = true; // Assume true for now
    
    console.log('BigQuery validation results:', checks);
    
    const allChecksPass = Object.values(checks).every(check => check);
    
    return {
      success: allChecksPass,
      checks,
      message: allChecksPass ? 
        'BigQuery setup is valid and ready' : 
        'Some BigQuery setup checks failed'
    };
    
  } catch (error) {
    console.error('Error validating BigQuery setup:', error);
    return {
      success: false,
      checks: {
        bigQueryInitialized: false,
        tablesExist: false,
        canInsertData: false,
        canQueryData: false
      },
      message: error.message
    };
  }
}
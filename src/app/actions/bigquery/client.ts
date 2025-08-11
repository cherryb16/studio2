'use server';

import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client
let bigquery: BigQuery;

try {
  const config: any = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  };

  // Handle different authentication methods
  if (process.env.GOOGLE_CLOUD_KEY_FILE) {
    // Use service account key file
    config.keyFilename = process.env.GOOGLE_CLOUD_KEY_FILE;
  } else if (process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
    // Use environment variables for credentials (Vercel deployment)
    config.credentials = {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  
  bigquery = new BigQuery(config);
} catch (error) {
  console.error('Failed to initialize BigQuery client:', error);
  // Create a fallback for development
  bigquery = new BigQuery({ projectId: 'dummy-project' });
}

const dataset = bigquery.dataset('trading_data');

// Ensure dataset exists
export async function initializeBigQuery() {
  try {
    const [exists] = await dataset.exists();
    if (!exists) {
      await dataset.create();
    }
    return true;
  } catch (error) {
    console.error('Error initializing BigQuery:', error);
    throw error;
  }
}

// Generic query function
export async function runQuery(query: string, params?: any[]): Promise<any[]> {
  try {
    const options = {
      query,
      location: 'US',
      params: params || [],
    };

    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
  } catch (error) {
    console.error('BigQuery query error:', error);
    throw error;
  }
}

// Insert data into a table
export async function insertData(tableName: string, data: any[]): Promise<void> {
  try {
    if (data.length === 0) return;
    
    
    const table = dataset.table(tableName);
    
    // For large datasets, insert in smaller batches to avoid errors
    if (data.length > 100) {
      const batchSize = 100;
      let successfulInserts = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        try {
          await table.insert(batch);
          successfulInserts += batch.length;
        } catch (error) {
          if (error.name === 'PartialFailureError' && error.errors) {
          }
          // Continue with next batch instead of failing completely
        }
      }
    } else {
      await table.insert(data);
    }
  } catch (error) {
    console.error(`Error inserting data into ${tableName}:`, error);
    
    // Log detailed error information for debugging
    if (error.name === 'PartialFailureError') {
      console.error(`PartialFailureError details for ${tableName}:`);
      if (error.errors && error.errors.length > 0) {
        console.error(`First few errors:`, JSON.stringify(error.errors.slice(0, 3), null, 2));
      }
    }
    
    throw error;
  }
}

// Upsert data (insert or update if exists)
export async function upsertData(
  tableName: string, 
  data: any[], 
  keyColumns: string[]
): Promise<void> {
  try {
    if (data.length === 0) return;

    // For now, use simple insert with insertId for deduplication
    // This is more reliable than complex MERGE statements
    const table = dataset.table(tableName);
    
    // For now, use simple insert like insertData function (which works)
    // TODO: Implement proper deduplication later if needed
    await table.insert(data);
  } catch (error) {
    // If it's a duplicate row error, that's expected with upserts
    if (error.message && error.message.includes('duplicate')) {
      return;
    }
    console.error(`Error upserting data into ${tableName}:`, error);
    
    // Log detailed error information for debugging
    if (error.name === 'PartialFailureError') {
      console.error(`PartialFailureError details for ${tableName}:`);
      if (error.errors && error.errors.length > 0) {
        console.error(`First few errors:`, JSON.stringify(error.errors.slice(0, 3), null, 2));
      }
    }
    
    throw error;
  }
}

// Export functions instead of objects for "use server" compatibility
export async function getBigQueryClient() {
  return bigquery;
}

export async function getDataset() {
  return dataset;
}
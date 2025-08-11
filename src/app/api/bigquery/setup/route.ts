import { NextRequest, NextResponse } from 'next/server';
import { initializeBigQuery } from '@/app/actions/bigquery/client';
import { validateBigQuerySetup } from '@/app/actions/migration/migrate-to-bigquery';

// Setup and validate BigQuery
export async function POST(request: NextRequest) {
  try {
    // Verify admin access (you might want to add authentication here)
    const { adminKey } = await request.json();
    
    if (adminKey !== process.env.ADMIN_SETUP_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('Initializing BigQuery setup...');
    
    // Initialize BigQuery
    await initializeBigQuery();
    
    // Validate the setup
    const validation = await validateBigQuerySetup();
    
    return NextResponse.json({
      success: true,
      message: 'BigQuery setup completed',
      validation
    });
    
  } catch (error) {
    console.error('Error setting up BigQuery:', error);
    return NextResponse.json(
      { 
        error: 'Setup failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// Get setup status
export async function GET() {
  try {
    const validation = await validateBigQuerySetup();
    
    return NextResponse.json({
      status: validation.success ? 'ready' : 'needs_setup',
      validation
    });
    
  } catch (error) {
    console.error('Error checking BigQuery status:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error.message
      },
      { status: 500 }
    );
  }
}
// API endpoint to completely delete all user data from Firestore
import { NextRequest, NextResponse } from 'next/server';
import { serverDeleteUser, serverSoftDeleteUser } from '@/lib/user-deletion-service';

export async function DELETE(request: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { userId, softDelete = false } = body;

    // Basic validation
    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing user ID' 
      }, { status: 400 });
    }

    console.log(`${softDelete ? 'Soft' : 'Hard'} deleting user: ${userId}`);

    if (softDelete) {
      // Soft delete - mark as deleted but keep data
      await serverSoftDeleteUser(userId);
      
      return NextResponse.json({ 
        success: true,
        message: `User ${userId} marked as deleted (data preserved for recovery)`
      });
    } else {
      // Hard delete - completely remove all data
      const deletionReport = await serverDeleteUser(userId);
      
      if (!deletionReport.success) {
        return NextResponse.json({ 
          error: deletionReport.error || 'Deletion failed' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        deletionReport,
        message: `User ${userId} and all associated data deleted successfully`
      });
    }

  } catch (error) {
    console.error('User deletion API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Optional: Handle POST for soft delete
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    // Soft delete via POST
    await serverSoftDeleteUser(userId);
    
    return NextResponse.json({ 
      success: true,
      message: `User ${userId} soft deleted successfully`
    });

  } catch (error) {
    console.error('Soft delete API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
'use server';

import { revalidatePath } from 'next/cache';

export async function triggerManualSync(userId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sync-trades`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }

    // Revalidate the trade journal page
    revalidatePath('/trade-journal');
    
    return result;
  } catch (error: any) {
    console.error('Error triggering manual sync:', error);
    throw new Error('Failed to sync trades');
  }
}

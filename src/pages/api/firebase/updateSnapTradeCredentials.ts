// src/pages/api/firebase/updateSnapTradeCredentials.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { firebaseUserId, snaptradeUserID, snaptradeUserSecret } = req.body;
  
  if (!firebaseUserId || !snaptradeUserID || !snaptradeUserSecret) {
    return res.status(400).json({ 
      error: 'firebaseUserId, snaptradeUserID, and snaptradeUserSecret are required' 
    });
  }

  try {
    // Store in snaptrade_users collection
    await db.collection('snaptrade_users').doc(firebaseUserId).set({
      snaptradeUserID: snaptradeUserID,
      snaptradeUserSecret: snaptradeUserSecret,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return res.status(200).json({ 
      success: true,
      message: 'SnapTrade credentials updated successfully'
    });
  } catch (error) {
    console.error('Error updating SnapTrade credentials:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
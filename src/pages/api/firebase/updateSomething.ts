// src/pages/api/firebase/updateSomething.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { firebaseUserId, data } = req.body as { firebaseUserId?: string; data?: any };
  if (!firebaseUserId || !data) {
    return res.status(400).json({ error: 'firebaseUserId and data are required' });
  }

  try {
    // Check if this is SnapTrade credentials update
    if (data.snaptradeUserID && data.snaptradeUserSecret) {
      console.log('Updating SnapTrade credentials for user:', firebaseUserId);
      
      // Store in snaptrade_users collection
      await db.collection('snaptrade_users').doc(firebaseUserId).set({
        snaptradeUserID: data.snaptradeUserID,
        snaptradeUserSecret: data.snaptradeUserSecret,
        snaptradeRegisteredAt: data.snaptradeRegisteredAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      // Also update users collection if needed
      await db.collection('users').doc(firebaseUserId).set({
        hasSnapTradeAccount: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      // Regular user data update
      await db.collection('users').doc(firebaseUserId).set(data, { merge: true });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating document:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
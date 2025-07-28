import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const firebaseUserId = req.query.firebaseUserId as string | undefined;
  if (!firebaseUserId) {
    return res.status(400).json({ error: 'firebaseUserId is required' });
  }

  try {
    const userDoc = await db.collection('snaptrade_users').doc(firebaseUserId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const snaptradeUserId = data?.snaptradeUserID;
      const userSecret = data?.snaptradeUserSecret;
      if (snaptradeUserId && userSecret) {
        return res.status(200).json({ snaptradeUserId, userSecret });
      }
    }
    return res.status(404).json({ error: 'SnapTrade credentials not found for this user' });
  } catch (error) {
    console.error('Error fetching SnapTrade credentials:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

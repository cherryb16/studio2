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
    const userDoc = await db.collection('users').doc(firebaseUserId).get();
    if (userDoc.exists) {
      return res.status(200).json(userDoc.data());
    }
    return res.status(404).json({ error: 'User not found' });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

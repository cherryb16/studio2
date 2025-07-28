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
    await db.collection('users').doc(firebaseUserId).set(data, { merge: true });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating document:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

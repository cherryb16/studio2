import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Disable all caching for this endpoint
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const firebaseUserId = req.query.firebaseUserId as string | undefined;
  if (!firebaseUserId) {
    return res.status(400).json({ error: 'firebaseUserId is required' });
  }

  try {
    console.log(`Fetching credentials for user: ${firebaseUserId}`);
    
    // Fetch SnapTrade User ID from main document
    const userDoc = await db.collection('snaptrade_users').doc(firebaseUserId).get();
    let snaptradeUserId = null;
    
    if (userDoc.exists) {
      const data = userDoc.data();
      snaptradeUserId = data?.SnaptradeUserID || firebaseUserId; // Use Firebase UID as fallback
      console.log(`Found user document, snaptradeUserId: ${snaptradeUserId}`);
    } else {
      snaptradeUserId = firebaseUserId; // Use Firebase UID as SnapTrade User ID
      console.log(`No user document found, using Firebase UID: ${firebaseUserId}`);
    }

    // Fetch user secret from secure collection
    const secretDoc = await db.collection('snaptrade_user_secrets').doc(firebaseUserId).get();
    
    if (secretDoc.exists) {
      const secretData = secretDoc.data();
      const userSecret = secretData?.secret;
      console.log(`Found secret document, has secret: ${!!userSecret}`);
      
      if (snaptradeUserId && userSecret) {
        console.log(`Returning credentials for user: ${firebaseUserId}`);
        return res.status(200).json({ snaptradeUserId, userSecret });
      }
    } else {
      console.log(`No secret document found for user: ${firebaseUserId}`);
    }
    
    console.log(`No valid credentials found for user: ${firebaseUserId}`);
    return res.status(404).json({ error: 'SnapTrade credentials not found for this user' });
  } catch (error) {
    console.error('Error fetching SnapTrade credentials:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

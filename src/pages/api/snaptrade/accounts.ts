import type { NextApiRequest, NextApiResponse } from 'next';
import { getSnapTradeAccounts } from '@/app/actions/snaptrade';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { snaptradeUserId, userSecret } = req.query;

  if (!snaptradeUserId || !userSecret) {
    return res.status(400).json({ error: 'snaptradeUserId and userSecret are required' });
  }

  try {
    const accounts = await getSnapTradeAccounts(
      snaptradeUserId as string,
      userSecret as string
    );

    if ('error' in accounts) {
      return res.status(500).json({ error: accounts.error });
    }

    return res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
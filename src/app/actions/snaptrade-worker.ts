// src/app/actions/snaptrade-worker.ts
'use server';

const WORKER_URL = process.env.SNAPTRADE_WORKER_URL || '';

interface WorkerRequestOptions {
  endpoint: string;
  method?: string;
  body?: any;
  userId: string;
  userSecret: string;
}

async function makeWorkerRequest<T>({
  endpoint,
  method = 'GET',
  body,
  userId,
  userSecret,
}: WorkerRequestOptions): Promise<T> {
  if (!WORKER_URL) {
    throw new Error('SNAPTRADE_WORKER_URL is not configured');
  }

  const url = `${WORKER_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-User-ID': userId,
    'X-User-Secret': userSecret,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`Worker request error for ${endpoint}:`, error);
    throw error;
  }
}

// Get accounts via worker
export async function getWorkerAccounts(userId: string, userSecret: string) {
  try {
    return await makeWorkerRequest<any[]>({
      endpoint: '/accounts',
      userId,
      userSecret,
    });
  } catch (error) {
    console.error('Error fetching accounts via worker:', error);
    return { error: 'Failed to fetch accounts' };
  }
}

// Get positions via worker
export async function getWorkerPositions(
  userId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    const params = accountId ? `?accountId=${accountId}` : '';
    return await makeWorkerRequest<any[]>({
      endpoint: `/positions${params}`,
      userId,
      userSecret,
    });
  } catch (error) {
    console.error('Error fetching positions via worker:', error);
    return { error: 'Failed to fetch positions' };
  }
}

// Get balances via worker
export async function getWorkerBalances(
  userId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    const params = accountId ? `?accountId=${accountId}` : '';
    return await makeWorkerRequest<any[]>({
      endpoint: `/balances${params}`,
      userId,
      userSecret,
    });
  } catch (error) {
    console.error('Error fetching balances via worker:', error);
    return { error: 'Failed to fetch balances' };
  }
}

// Get holdings via worker
export async function getWorkerHoldings(
  userId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    const params = accountId ? `?accountId=${accountId}` : '';
    return await makeWorkerRequest<any>({
      endpoint: `/holdings${params}`,
      userId,
      userSecret,
    });
  } catch (error) {
    console.error('Error fetching holdings via worker:', error);
    return { error: 'Failed to fetch holdings' };
  }
}

// Get analytics via worker
export async function getWorkerAnalytics(
  userId: string,
  userSecret: string,
  accountId?: string
) {
  try {
    const params = accountId ? `?accountId=${accountId}` : '';
    return await makeWorkerRequest<any>({
      endpoint: `/analytics${params}`,
      userId,
      userSecret,
    });
  } catch (error) {
    console.error('Error fetching analytics via worker:', error);
    return { error: 'Failed to fetch analytics' };
  }
}

// Get login URL via worker
export async function getWorkerLoginUrl(userId: string, userSecret: string) {
  try {
    return await makeWorkerRequest<{ redirectURI: string }>({
      endpoint: '/login-url',
      method: 'POST',
      userId,
      userSecret,
    });
  } catch (error) {
    console.error('Error getting login URL via worker:', error);
    return { error: 'Failed to get login URL' };
  }
}
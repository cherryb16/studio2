// src/lib/snaptrade-worker-client.ts
'use client';

interface WorkerResponse<T> {
  data?: T;
  error?: string;
}

class SnapTradeWorkerClient {
  private baseUrl: string;
  private credentials: { userId: string; userSecret: string } | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SNAPTRADE_WORKER_URL || '';
    if (!this.baseUrl) {
      console.error('NEXT_PUBLIC_SNAPTRADE_WORKER_URL is not set');
    }
    console.log('SnapTrade Worker URL:', this.baseUrl);
  }

  setCredentials(userId: string, userSecret: string) {
    console.log('Setting credentials for user:', userId);
    console.log('Setting userSecret:', userSecret);
    this.credentials = { userId, userSecret };
  }

  private async makeRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    if (!this.credentials) {
      throw new Error('No credentials set. Call setCredentials first.');
    }

    if (!this.baseUrl) {
      throw new Error('Worker URL not configured. Set NEXT_PUBLIC_SNAPTRADE_WORKER_URL environment variable.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    console.log(`Making request to: ${url}`);

    console.log('Calling SnapTrade with:');
    console.log('  clientId:', process.env.NEXT_PUBLIC_SNAPTRADE_CLIENT_ID);
    console.log('  userId:', this.credentials.userId);
    console.log('  userSecret:', this.credentials.userSecret);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-User-ID': this.credentials.userId,
      'X-User-Secret': this.credentials.userSecret,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Worker request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          endpoint,
        });
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`Error calling ${endpoint}:`, error);
      throw error;
    }
  }

  // API Methods
  async getAccounts() {
    return this.makeRequest<any[]>('/accounts');
  }

  async getPositions(accountId?: string) {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.makeRequest<any[]>(`/positions${params}`);
  }

  async getBalances(accountId?: string) {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.makeRequest<any[]>(`/balances${params}`);
  }

  async getHoldings(accountId?: string) {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.makeRequest<any>(`/holdings${params}`);
  }

  async getAnalytics(accountId?: string) {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.makeRequest<any>(`/analytics${params}`);
  }

  async getLoginUrl() {
    return this.makeRequest<{ redirectURI: string }>('/login-url', 'POST');
  }

  async checkHealth() {
    return this.makeRequest<{ status: string; timestamp: string }>('/health');
  }

  // Helper method to verify credentials are set
  hasCredentials(): boolean {
    return this.credentials !== null;
  }
}

// Export singleton instance
export const snaptradeWorker = new SnapTradeWorkerClient();
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { generateRiskDashboard } from '@/app/actions/advanced-analytics';
import { getPerformanceMetrics } from '@/app/actions/snaptrade-enhanced';
import { testSnapTradeConnection } from '@/app/actions/test-snaptrade';

export default function DebugPage() {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<any>(null);

  const { data: snaptradeCredentials } = useQuery({
    queryKey: ['snaptradeCredentials', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error('No user ID');
      const res = await fetch(`/api/firebase/getCredentials?firebaseUserId=${user.uid}`);
      if (!res.ok) throw new Error('Failed to fetch credentials');
      return res.json();
    },
    enabled: !!user?.uid,
  });

  const testRiskData = async () => {
    if (!snaptradeCredentials) return;
    
    try {
      console.log('Testing risk data with:', { 
        userId: snaptradeCredentials.snaptradeUserId,
        hasSecret: !!snaptradeCredentials.userSecret 
      });
      
      const result = await generateRiskDashboard(
        snaptradeCredentials.snaptradeUserId,
        snaptradeCredentials.userSecret,
        'moderate'
      );
      
      console.log('Risk result:', result);
      setTestResults({ type: 'risk', data: result });
    } catch (error) {
      console.error('Risk test error:', error);
      setTestResults({ type: 'risk', error: error instanceof Error ? error.message : String(error) });
    }
  };

  const testPerformanceData = async () => {
    if (!snaptradeCredentials) return;
    
    try {
      console.log('Testing performance data...');
      
      const result = await getPerformanceMetrics(
        snaptradeCredentials.snaptradeUserId,
        snaptradeCredentials.userSecret
      );
      
      console.log('Performance result:', result);
      setTestResults({ type: 'performance', data: result });
    } catch (error) {
      console.error('Performance test error:', error);
      setTestResults({ type: 'performance', error: error instanceof Error ? error.message : String(error) });
    }
  };

  const testConnection = async () => {
    if (!snaptradeCredentials) return;
    
    try {
      console.log('Testing SnapTrade connection...');
      
      const result = await testSnapTradeConnection(
        snaptradeCredentials.snaptradeUserId,
        snaptradeCredentials.userSecret
      );
      
      console.log('Connection test result:', result);
      setTestResults({ type: 'connection', data: result });
    } catch (error) {
      console.error('Connection test error:', error);
      setTestResults({ type: 'connection', error: error instanceof Error ? error.message : String(error) });
    }
  };

  // Twelve Data testing removed - API disabled to avoid costs

  const testEnhancedPerformanceData = async () => {
    if (!snaptradeCredentials) return;
    
    try {
      console.log('Testing enhanced performance data...');
      
      const response = await fetch(
        `/api/test-performance-data?userId=${encodeURIComponent(snaptradeCredentials.snaptradeUserId)}&userSecret=${encodeURIComponent(snaptradeCredentials.userSecret)}`
      );
      const result = await response.json();
      
      console.log('Enhanced performance test result:', result);
      setTestResults({ type: 'enhanced-performance', data: result });
    } catch (error) {
      console.error('Enhanced performance test error:', error);
      setTestResults({ type: 'enhanced-performance', error: error instanceof Error ? error.message : String(error) });
    }
  };

  if (!user) {
    return <div>Please log in to test data loading</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Debug Data Loading</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>SnapTrade Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-gray-100 p-4 rounded">
            {JSON.stringify({
              hasCredentials: !!snaptradeCredentials,
              userId: snaptradeCredentials?.snaptradeUserId ? 'Present' : 'Missing',
              userSecret: snaptradeCredentials?.userSecret ? 'Present' : 'Missing'
            }, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <div className="flex gap-4 flex-wrap">
        <Button onClick={testConnection} disabled={!snaptradeCredentials} variant="default">
          Test SnapTrade Connection
        </Button>
        <Button onClick={testRiskData} disabled={!snaptradeCredentials}>
          Test Risk Data
        </Button>
        <Button onClick={testPerformanceData} disabled={!snaptradeCredentials}>
          Test Performance Data
        </Button>
        <Button onClick={testEnhancedPerformanceData} disabled={!snaptradeCredentials}>
          Test Enhanced Performance Data
        </Button>
      </div>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>{testResults.type} Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {testResults.error ? 
                `Error: ${testResults.error}` : 
                JSON.stringify(testResults.data, null, 2)
              }
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
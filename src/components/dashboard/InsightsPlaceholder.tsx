'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InsightsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights</CardTitle>
        <CardDescription>
          Coming soon: Personalized financial insights and trends.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          We're working on bringing you even deeper insights into your portfolio's performance
          and opportunities. Stay tuned!
        </p>
      </CardContent>
    </Card>
  );
}
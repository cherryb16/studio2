// src/app/(app)/settings/page.tsx
import React from 'react';
import { ConnectBrokerageButton } from '@/components/connect-brokerage-button';

const SettingsPage = () => {
  return (
    <div>
      <h1>Settings Page</h1>
      {/* Add your settings content here */}
 <ConnectBrokerageButton />
    </div>
  );
};

export default SettingsPage;
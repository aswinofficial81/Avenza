import React from 'react';
import { DsaOverview } from '../features/dsa/components/DsaOverview';
import { DsaProblemsList } from '../features/dsa/components/DsaProblemsList';

export const DsaPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <DsaOverview />
      <DsaProblemsList />
    </div>
  );
};
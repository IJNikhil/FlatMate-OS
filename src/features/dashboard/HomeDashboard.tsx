import React from 'react';
import { BalanceSummary } from './components/BalanceSummary';
import { SmartBuyList } from './components/SmartBuyList';
import { MonthlyBudgetCard } from '../expenses/components/MonthlyBudgetCard';

export const HomeDashboard: React.FC = () => (
  <div className="mx-auto w-full max-w-3xl space-y-6">
    <MonthlyBudgetCard />
    <BalanceSummary />
    <SmartBuyList />
  </div>
);

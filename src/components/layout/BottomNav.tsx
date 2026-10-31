import React from 'react';
import { CircleDollarSign, Package, ReceiptText, ShoppingCart } from 'lucide-react';

export type AppTab = 'buy-list' | 'pantry' | 'expenses' | 'settlements';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'buy-list', label: 'Smart Buy List', icon: ShoppingCart },
    { id: 'pantry', label: 'Pantry', icon: Package },
    { id: 'expenses', label: 'Expenses', icon: ReceiptText },
    { id: 'settlements', label: 'Settlements', icon: CircleDollarSign },
  ] as const;

  return (
    <nav
      aria-label="Main navigation"
      className="relative z-50 mx-auto flex-none w-full max-w-4xl border-t border-white/10 bg-slate-900/75 pb-safe backdrop-blur-xl"
    >
      <div className="flex justify-around px-1 pt-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-sky-400 min-[380px]:text-xs ${
                isActive ? 'text-sky-400' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

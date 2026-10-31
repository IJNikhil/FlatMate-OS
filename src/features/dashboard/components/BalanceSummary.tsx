import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { useAppData } from '../../../services/store/AppDataContext';
import { calculateGroupBalances } from '../../settlements/utils/debtSimplifier';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const BalanceSummary: React.FC = () => {
  const { expenses, groups, members, member_groups, isLoading } = useAppData();
  const currentUser = members.find((member) => member.is_active);
  const householdGroup = groups.find((group) => group.group_id === 'GRP_ALL');

  const { netBalance, monthSpend } = useMemo(() => {
    const balances = calculateGroupBalances(expenses, members, member_groups);
    const now = new Date();
    const spend = expenses.reduce((total, expense) => {
      const date = new Date(expense.timestamp);
      const isCurrentMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      return isCurrentMonth && expense.group_id === 'GRP_ALL'
        ? total + Number(expense.amount || 0)
        : total;
    }, 0);

    return {
      netBalance: currentUser ? balances[currentUser.user_id] ?? 0 : 0,
      monthSpend: spend,
    };
  }, [expenses, members, member_groups, currentUser]);

  const isOwed = netBalance > 0.005;
  const owes = netBalance < -0.005;
  const balanceLabel = isOwed ? 'You are owed' : owes ? 'You owe' : 'You’re all settled';
  const balanceIcon = isOwed ? ArrowDownLeft : owes ? ArrowUpRight : Wallet;
  const BalanceIcon = balanceIcon;
  const budgetTarget = householdGroup?.budget_target ?? 0;
  const budgetPercent = budgetTarget > 0 ? Math.min((monthSpend / budgetTarget) * 100, 100) : 0;

  if (isLoading && members.length === 0 && expenses.length === 0) {
    return (
      <section aria-label="Loading household balance" className="space-y-5 py-2" role="status">
        <span className="sr-only">Loading household balance</span>
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-800/50" />
          <div className="h-4 w-28 animate-pulse rounded bg-zinc-800/50" />
          <div className="h-9 w-44 animate-pulse rounded bg-zinc-800/50" />
        </div>
        <LoadingSkeleton rows={1} />
      </section>
    );
  }

  return (
    <section aria-label="Household balance summary" className="py-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-400">{currentUser ? `Hi, ${currentUser.name}` : 'Household balance'}</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
            <BalanceIcon size={16} aria-hidden="true" className={isOwed ? 'text-emerald-400' : owes ? 'text-amber-400' : 'text-zinc-400'} />
            <span>{balanceLabel}</span>
          </div>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-zinc-50 sm:text-4xl">
            {inr.format(Math.abs(netBalance))}
          </p>
        </div>
        <span className="p-2 text-zinc-400">
          <Wallet size={20} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-7 border-t border-zinc-800/40 pt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-300">Household budget</p>
            <p className="mt-1 text-xs text-zinc-400">This month · {householdGroup?.group_name ?? 'Global household'}</p>
          </div>
          <p className="text-right font-mono text-sm tabular-nums text-zinc-50">
            {inr.format(monthSpend)}<span className="text-zinc-400"> / {inr.format(budgetTarget)}</span>
          </p>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-label="Monthly household budget used"
          aria-valuemin={0}
          aria-valuemax={budgetTarget || 0}
          aria-valuenow={Math.min(monthSpend, budgetTarget)}
        >
          <div
            className={`h-full rounded-full transition-[width] ${budgetPercent >= 90 ? 'bg-rose-500' : budgetPercent >= 75 ? 'bg-amber-500' : 'bg-sky-500'}`}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
        <p className="mt-2 text-right text-sm text-zinc-400">
          {budgetTarget > 0 ? `${Math.round((monthSpend / budgetTarget) * 100)}% of monthly budget` : 'No budget target set'}
        </p>
      </div>
    </section>
  );
};

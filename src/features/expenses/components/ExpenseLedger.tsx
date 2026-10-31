import React, { useMemo, useState } from 'react';
import { ChevronDown, History, Plus } from 'lucide-react';
import { useAppData } from '../../../services/store/AppDataContext';
import { ExpenseEntrySheet } from './ExpenseEntrySheet';
import { TransactionList } from './TransactionList';
import { getMemberGroupIds } from '../../groups/utils/membership';
import { BudgetManager } from './BudgetManager';
import { HistoryView } from '../../history/components/HistoryView';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

export const ExpenseLedger: React.FC = () => {
  const { expenses, groups, members, member_groups, current_user } = useAppData();
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const activeMember = current_user ?? members.find((member) => member.is_active);
  const memberGroupIds = useMemo(() => getMemberGroupIds(activeMember?.user_id, member_groups), [activeMember?.user_id, member_groups]);
  const visibleGroups = useMemo(() => groups.filter((group) => memberGroupIds.has(group.group_id)), [groups, memberGroupIds]);
  const household = visibleGroups.find((group) => group.group_id === 'GRP_ALL');
  const visibleExpenses = useMemo(() => expenses.filter((expense) => memberGroupIds.has(expense.group_id)), [expenses, memberGroupIds]);
  const { monthlySpend, subgroupBudgets } = useMemo(() => {
    const now = new Date();
    const monthExpenses = visibleExpenses.filter((expense) => {
      const date = new Date(expense.timestamp);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });

    const spendByGroup = new Map<string, number>();
    monthExpenses.forEach((expense) => {
      spendByGroup.set(expense.group_id, (spendByGroup.get(expense.group_id) ?? 0) + Number(expense.amount || 0));
    });

    const subgroups = visibleGroups
      .filter((group) => group.group_id !== 'GRP_ALL')
      .map((group) => ({ ...group, spent: spendByGroup.get(group.group_id) ?? 0 }));

    return {
      monthlySpend: spendByGroup.get('GRP_ALL') ?? 0,
      subgroupBudgets: subgroups,
    };
  }, [visibleExpenses, visibleGroups]);
  const budget = household?.budget_target ?? 0;
  const progress = budget > 0 ? Math.min((monthlySpend / budget) * 100, 100) : 0;
  const sortedExpenses = [...visibleExpenses].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (showHistory) {
    return <HistoryView expenses={sortedExpenses} mode="expenses" onBack={() => setShowHistory(false)} />;
  }

  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="expense-ledger-title">
      <header className="mb-6 space-y-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Household finances</p>
          <h2 id="expense-ledger-title" className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Expenses</h2>
          <p className="mt-1 text-sm text-zinc-500">This month at a glance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setIsEntryOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-colors hover:from-blue-500 hover:to-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            <Plus size={17} aria-hidden="true" /> Log expense
          </button>
          <button type="button" onClick={() => setShowHistory(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-400">
            <History size={16} aria-hidden="true" /> History
          </button>
        </div>
      </header>

      <section aria-label="Household monthly budget" className="mb-6 border-y border-zinc-800/40 py-5">
        {household && (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Global house · spent</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">{inr.format(monthlySpend)}</p>
              </div>
              <p className="shrink-0 pb-1 text-right font-mono text-sm tabular-nums text-zinc-400">of {inr.format(budget)}</p>
            </div>
            <div role="progressbar" aria-label="Global house budget spent" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Math.min(monthlySpend, budget)} className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800/70">
              <div className={`h-full rounded-full transition-[width] ${progress >= 90 ? 'bg-rose-500' : progress >= 75 ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>{budget ? `${Math.round((monthlySpend / budget) * 100)}% used` : 'No budget limit set'}</span>
              {budget > 0 && <span className="font-mono tabular-nums">{inr.format(Math.max(0, budget - monthlySpend))} left</span>}
            </div>
          </>
        )}
        {subgroupBudgets.length > 0 && (
          <details className="group mt-4 border-t border-zinc-800/40 pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm text-zinc-400 [&::-webkit-details-marker]:hidden">
              <span>Group budgets <span className="text-zinc-600">· {subgroupBudgets.length}</span></span>
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="divide-y divide-zinc-800/40">
              {subgroupBudgets.map((group) => {
                return (
                  <li key={group.group_id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-zinc-300">{group.group_name}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-50">{inr.format(group.spent)} <span className="text-zinc-500">/ {inr.format(group.budget_target)}</span></span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>

      <BudgetManager />

      <section aria-label="Recent household activity" className="pt-5">
        <h3 className="mb-3 text-base font-semibold text-zinc-100">Activity</h3>
        <TransactionList expenses={sortedExpenses} />
      </section>

      <ExpenseEntrySheet
        isOpen={isEntryOpen}
        groups={visibleGroups}
        onClose={() => setIsEntryOpen(false)}
      />
    </section>
  );
};

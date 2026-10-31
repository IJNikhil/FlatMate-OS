import React, { useState } from 'react';
import { ArrowDownToLine, ReceiptText, Trash2 } from 'lucide-react';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import { deleteExpense } from '../../../services/api/gasClient';
import { useAppData } from '../../../services/store/AppDataContext';
import type { ExpenseLog } from '../../../types/database';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { SwipeActionRow } from '../../../components/ui/SwipeActionRow';
import { triggerHapticFeedback } from '../../../components/ui/haptics';

interface TransactionListProps {
  expenses: ExpenseLog[];
  isLoading?: boolean;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

export const TransactionList: React.FC<TransactionListProps> = ({ expenses, isLoading = false }) => {
  const { groups, members, refreshData } = useAppData();
  const [selected, setSelected] = useState<ExpenseLog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (expenseId: string) => {
    setDeletingId(expenseId);
    setError(null);
    try {
      await deleteExpense(expenseId);
      await refreshData();
      triggerHapticFeedback();
      setSelected((current) => current?.expense_id === expenseId ? null : current);
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this expense.');
    } finally {
      setDeletingId(null);
    }
  };

  const groupedExpenses = groups
    .map((group) => ({
      group,
      transactions: expenses.filter((expense) => expense.group_id === group.group_id),
    }))
    .filter(({ transactions }) => transactions.length > 0);
  const ungrouped = expenses.filter((expense) => !groups.some((group) => group.group_id === expense.group_id));
  if (ungrouped.length) groupedExpenses.push({
    group: { group_id: 'OTHER', group_name: 'Other', budget_target: 0 },
    transactions: ungrouped,
  });

  return (
    <>
      {isLoading && expenses.length === 0 ? (
        <LoadingSkeleton rows={4} />
      ) : expenses.length === 0 ? (
        <div className="py-10 text-center">
          <ReceiptText size={23} className="mx-auto mb-3 text-zinc-500" aria-hidden="true" />
          <p className="text-sm text-zinc-500">No expenses yet. Add the first household transaction.</p>
        </div>
      ) : (
        <div>
          {groupedExpenses.map(({ group, transactions }) => (
            <section key={group.group_id} aria-label={`${group.group_name} transactions`}>
              <h4 className="sticky top-[4.5rem] z-10 bg-black/85 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 backdrop-blur-md">
                {group.group_name}
              </h4>
              <ul className="divide-y divide-zinc-800/40">
                {transactions.map((expense) => {
                  const payer = members.find((member) => member.user_id === expense.paid_by)?.name ?? 'Unknown';
                  const date = new Date(expense.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  return (
                    <li key={expense.expense_id}>
                      <SwipeActionRow direction="left" label="Delete" icon={Trash2} tone="rose" disabled={deletingId === expense.expense_id} onAction={() => void handleDelete(expense.expense_id)}>
                        <button
                          type="button"
                          onClick={() => { setError(null); setSelected(expense); }}
                          className="flex min-h-20 w-full cursor-pointer items-center justify-between gap-4 px-2 py-5 text-left transition-colors active:bg-zinc-900/50 focus-visible:outline-2 focus-visible:outline-sky-500"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-zinc-50">{expense.item_id}</span>
                            <span className="mt-1 block truncate text-sm text-zinc-400">{payer} · {date}</span>
                          </span>
                          <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-zinc-50">{inr.format(Number(expense.amount))}</span>
                        </button>
                      </SwipeActionRow>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <ResponsiveActionSheet
          title="Transaction details"
          isOpen
          onClose={() => setSelected(null)}
          closeDisabled={deletingId === selected.expense_id}
        >
          <div className="space-y-5">
            <header>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-sky-400">Transaction details</p>
              <h3 className="mt-1 text-xl font-semibold text-zinc-50">{selected.item_id}</h3>
            </header>
            <dl className="divide-y divide-zinc-800/40 border-y border-zinc-800/40">
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-400">Amount</dt>
                <dd className="font-mono text-sm font-medium tabular-nums text-zinc-50">{inr.format(Number(selected.amount))}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-400">Paid by</dt>
                <dd className="text-sm font-medium text-zinc-50">{members.find((member) => member.user_id === selected.paid_by)?.name ?? 'Unknown'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-400">Split group</dt>
                <dd className="text-right text-sm font-medium text-zinc-50">{groups.find((group) => group.group_id === selected.group_id)?.group_name ?? selected.group_id}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-400">Date</dt>
                <dd className="text-sm font-medium text-zinc-50">{new Date(selected.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              </div>
            </dl>
            {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
            <button type="button" disabled={deletingId === selected.expense_id} onClick={() => void handleDelete(selected.expense_id)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50">
              <Trash2 size={16} aria-hidden="true" />{deletingId === selected.expense_id ? 'Deleting…' : 'Delete transaction'}
            </button>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400"><ArrowDownToLine size={14} aria-hidden="true" />Stored in household ledger</div>
          </div>
        </ResponsiveActionSheet>
      )}
    </>
  );
};

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, History, ReceiptText, Banknote, ExternalLink } from 'lucide-react';
import type { ExpenseLog } from '../../../types/database';
import { useAppData } from '../../../services/store/AppDataContext';

export interface SettledDebtRecord {
  id: string;
  fromName?: string;
  toName?: string;
  payerName?: string;
  payeeName?: string;
  amount: number;
  settledAt: string;
}

interface HistoryViewProps {
  expenses: ExpenseLog[];
  settlements?: SettledDebtRecord[];
  mode: 'expenses' | 'settlements' | 'budget';
  onBack: () => void;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function monthKey(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export const HistoryView: React.FC<HistoryViewProps> = ({ expenses, settlements = [], mode, onBack }) => {
  const { budget_collections, members } = useAppData();
  const [activeSection, setActiveSection] = useState<'expenses' | 'settlements' | 'budget'>(mode);

  const monthlyExpenses = useMemo(() => {
    const grouped = new Map<string, ExpenseLog[]>();
    expenses.forEach((expense) => {
      const key = monthKey(expense.timestamp);
      grouped.set(key, [...(grouped.get(key) ?? []), expense]);
    });
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  const monthlySettlements = useMemo(() => {
    const grouped = new Map<string, SettledDebtRecord[]>();
    settlements.forEach((settlement) => {
      const key = monthKey(settlement.settledAt);
      grouped.set(key, [...(grouped.get(key) ?? []), settlement]);
    });
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [settlements]);

  const monthlyBudgets = useMemo(() => {
    const grouped = new Map<string, typeof budget_collections>();
    (budget_collections || []).forEach((item) => {
      const key = item.month_cycle || 'Other';
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [budget_collections]);

  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="history-title">
      <button type="button" onClick={onBack} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-50">
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </button>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Archive</p>
        <h2 id="history-title" className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">History &amp; Past Cycles</h2>
      </header>
      <div role="tablist" aria-label="History category" className="mb-5 flex border-b border-zinc-800/40">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'expenses'}
          onClick={() => setActiveSection('expenses')}
          className={`min-h-12 px-4 text-sm font-medium ${activeSection === 'expenses' ? 'border-b-2 border-sky-400 text-zinc-50' : 'text-zinc-500'}`}
        >
          Expenses
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'settlements'}
          onClick={() => setActiveSection('settlements')}
          className={`min-h-12 px-4 text-sm font-medium ${activeSection === 'settlements' ? 'border-b-2 border-sky-400 text-zinc-50' : 'text-zinc-500'}`}
        >
          Settlements
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'budget'}
          onClick={() => setActiveSection('budget')}
          className={`min-h-12 px-4 text-sm font-medium ${activeSection === 'budget' ? 'border-b-2 border-sky-400 text-zinc-50' : 'text-zinc-500'}`}
        >
          Budget Dues
        </button>
      </div>

      {activeSection === 'expenses' && (
        monthlyExpenses.length ? (
          <div className="divide-y divide-zinc-800/40">
            {monthlyExpenses.map(([month, monthItems], index) => (
              <details key={month} open={index === 0} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2 text-sm font-semibold text-zinc-300"><ReceiptText size={16} className="text-zinc-500" aria-hidden="true" />{monthLabel(month)}</span>
                  <span className="font-mono text-xs tabular-nums text-zinc-500">{monthItems.length} {monthItems.length === 1 ? 'entry' : 'entries'}</span>
                </summary>
                <ul className="divide-y divide-zinc-800/40 pl-2">
                  {monthItems.map((expense) => (
                    <li key={expense.expense_id} className="flex min-h-16 items-center justify-between gap-4 py-4">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-50">{expense.item_id}</span>
                        <span className="mt-1 block text-sm text-zinc-500">{new Date(expense.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </span>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-400">{currency.format(Number(expense.amount))}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center"><History size={22} className="mx-auto mb-3 text-zinc-600" aria-hidden="true" /><p className="text-sm text-zinc-500">No past expense cycles yet.</p></div>
        )
      )}

      {activeSection === 'settlements' && (
        monthlySettlements.length ? (
          <div className="divide-y divide-zinc-800/40">
            {monthlySettlements.map(([month, records]) => (
              <section key={month} className="py-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{monthLabel(month)}</h3>
                <ul className="divide-y divide-zinc-800/40">
                  {records.map((record) => (
                    <li key={record.id} className="flex min-h-16 items-center justify-between gap-4 py-4 text-zinc-500">
                      <span className="flex min-w-0 items-center gap-3">
                        <Check size={16} className="shrink-0 text-zinc-600" aria-label="Paid" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-zinc-400"><strong className="font-medium text-zinc-200">{record.fromName || record.payerName}</strong> paid <strong className="font-medium text-zinc-200">{record.toName || record.payeeName}</strong></span>
                          <span className="mt-1 block text-xs text-zinc-600">{new Date(record.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-500">{currency.format(record.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center"><History size={22} className="mx-auto mb-3 text-zinc-600" aria-hidden="true" /><p className="text-sm text-zinc-500">No past settlement cycles yet.</p></div>
        )
      )}

      {activeSection === 'budget' && (
        monthlyBudgets.length ? (
          <div className="divide-y divide-zinc-800/40">
            {monthlyBudgets.map(([month, items]) => (
              <section key={month} className="py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400">{month.length === 7 ? monthLabel(month) : month}</h3>
                  <span className="text-xs text-zinc-400">
                    {items.filter((i) => i.status === 'VERIFIED' || i.status === 'PAID').length} of {items.length} collected
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const member = members.find((m) => m.user_id === item.user_id);
                    return (
                      <div key={item.collection_id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 p-3 text-xs">
                        <div>
                          <p className="font-medium text-slate-100">{member?.name || item.user_id}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{currency.format(Number(item.amount))} · {item.payment_method || 'Quota'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.screenshot_url && (
                            <a href={item.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline flex items-center gap-0.5">
                              Proof <ExternalLink size={10} />
                            </a>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            item.status === 'VERIFIED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : item.status === 'PAID'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center"><Banknote size={22} className="mx-auto mb-3 text-zinc-600" aria-hidden="true" /><p className="text-sm text-zinc-500">No budget collection archives yet.</p></div>
        )
      )}
    </section>
  );
};

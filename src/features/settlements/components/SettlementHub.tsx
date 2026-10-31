import React, { useMemo, useState } from 'react';
import { ArrowRight, CircleCheck, History } from 'lucide-react';
import { useAppData } from '../../../services/store/AppDataContext';
import { calculateGroupBalances, simplifyDebts, type SettlementTransaction } from '../utils/debtSimplifier';
import { PaymentSheet } from './PaymentSheet';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { HistoryView, type SettledDebtRecord } from '../../history/components/HistoryView';

export const SettlementHub: React.FC = () => {
  const { expenses, members, member_groups, isLoading, current_user, settlements } = useAppData();
  const [selected, setSelected] = useState<SettlementTransaction | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const transactions = useMemo(() => {
    if (!expenses.length || !members.length) return [];
    return simplifyDebts(calculateGroupBalances(expenses, members, member_groups));
  }, [expenses, members, member_groups]);

  const activeMember = current_user ?? members.find((member) => member.is_active);
  const personalTransactions = transactions.filter((transaction) =>
    activeMember && (transaction.from === activeMember.user_id || transaction.to === activeMember.user_id)
  );
  const debtor = selected ? members.find((member) => member.user_id === selected.from) : undefined;
  const creditor = selected ? members.find((member) => member.user_id === selected.to) : undefined;

  const settledDebtRecords = useMemo((): SettledDebtRecord[] => {
    return (settlements ?? []).map((st) => {
      const payer = members.find((m) => m.user_id === st.payer_id);
      const payee = members.find((m) => m.user_id === st.payee_id);
      return {
        id: st.settlement_id,
        settledAt: st.timestamp,
        payerName: payer?.name ?? st.payer_id,
        payeeName: payee?.name ?? st.payee_id,
        amount: st.amount
      };
    });
  }, [settlements, members]);

  if (showHistory) {
    return (
      <HistoryView
        expenses={expenses}
        settlements={settledDebtRecords}
        mode="settlements"
        onBack={() => setShowHistory(false)}
      />
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="settlement-title">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Household balances</p>
          <h2 id="settlement-title" className="mt-1 break-words text-2xl font-semibold tracking-tight text-zinc-50">Household Balances &amp; Settlement Hub (End of Month)</h2>
          <p className="mt-1 text-sm text-zinc-400">Your share is deducted before reimbursements are calculated.</p>
        </div>
        <button type="button" onClick={() => setShowHistory(true)} className="inline-flex min-h-11 shrink-0 self-start items-center gap-2 rounded-xl px-2 text-sm font-medium text-zinc-400 hover:text-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-400 sm:self-auto">
          <History size={16} aria-hidden="true" /> History
        </button>
      </header>
      {isLoading && expenses.length === 0 ? (
        <LoadingSkeleton rows={3} />
      ) : personalTransactions.length === 0 ? (
        <div className="py-10 text-center">
          <CircleCheck size={23} className="mx-auto mb-3 text-zinc-500" aria-hidden="true" />
          <p className="text-sm text-zinc-500">No debts this month. You are all settled.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/40">
          {personalTransactions.map((transaction) => {
            const from = members.find((member) => member.user_id === transaction.from);
            const to = members.find((member) => member.user_id === transaction.to);
            if (!from || !to) return null;
            const activeUserIsPayer = transaction.from === activeMember?.user_id;
            return (
              <li key={`${transaction.from}-${transaction.to}`}>
                <button type="button" onClick={() => setSelected(transaction)} className="flex min-h-20 w-full cursor-pointer items-center justify-between gap-4 px-2 py-5 text-left transition-colors active:bg-zinc-900/50 focus-visible:outline-2 focus-visible:outline-sky-500">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-50">
                      {activeUserIsPayer
                        ? <>You owe <span className="font-normal text-zinc-400">{to.name}</span></>
                        : <><span className="font-normal text-zinc-400">{from.name} owes</span> You</>}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">Tap for payment details</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm font-medium tabular-nums text-zinc-50">₹{transaction.amount.toFixed(2)}</span>
                    <ArrowRight size={16} className="text-zinc-400" aria-hidden="true" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && debtor && creditor && (
        <PaymentSheet
          key={`${selected.from}-${selected.to}`}
          transaction={selected}
          debtor={debtor}
          creditor={creditor}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
};

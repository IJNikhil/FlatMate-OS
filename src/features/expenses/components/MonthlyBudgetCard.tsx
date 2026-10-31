import React, { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { useAppData } from '../../../services/store/AppDataContext';
import { useToast } from '../../../components/ui/Toast';
import { triggerHapticFeedback } from '../../../components/ui/haptics';
import { BudgetPaymentSheet } from './BudgetPaymentSheet';
import type { BudgetCollection } from '../../../types/database';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 });

export const MonthlyBudgetCard: React.FC = () => {
  const { current_user, members, current_cycle, current_budget_collections, verifyBudgetCollectionOptimistic } = useAppData();
  const { showToast } = useToast();
  const [selectedForPayment, setSelectedForPayment] = useState<BudgetCollection | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState<string | null>(null);

  if (!current_budget_collections || current_budget_collections.length === 0) {
    return null;
  }

  const totalQuota = current_budget_collections.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const collectedAmount = current_budget_collections
    .filter((c) => c.status === 'PAID' || c.status === 'VERIFIED')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const percentCollected = totalQuota > 0 ? Math.min(100, Math.round((collectedAmount / totalQuota) * 100)) : 0;
  const paidCount = current_budget_collections.filter((c) => c.status === 'PAID' || c.status === 'VERIFIED').length;
  const totalCount = current_budget_collections.length;

  // Active user's collection record
  const myCollection = current_budget_collections.find((c) => c.user_id === current_user?.user_id);
  const isMyDuePending = myCollection && myCollection.status === 'PENDING';

  const handleVerify = async (collectionId: string) => {
    setIsVerifyingId(collectionId);
    try {
      await verifyBudgetCollectionOptimistic(collectionId);
      triggerHapticFeedback(25);
      showToast('Payment verified and confirmed!', 'success');
    } catch {
      showToast('Could not verify payment.', 'error');
    } finally {
      setIsVerifyingId(null);
    }
  };

  return (
    <section aria-labelledby="monthly-collection-heading" className="mb-6 rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Monthly Budget Collection</p>
          <h2 id="monthly-collection-heading" className="mt-0.5 text-lg font-bold tracking-tight text-slate-50">
            Household Pool · {current_cycle || 'Current Month'}
          </h2>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 border border-white/5">
          {paidCount} of {totalCount} flatmates contributed
        </span>
      </header>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Collected: <strong className="text-slate-100">{inr.format(collectedAmount)}</strong></span>
          <span className="text-slate-400">Goal: <strong className="text-slate-200">{inr.format(totalQuota)}</strong></span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentCollected >= 100 ? 'bg-emerald-400' : percentCollected >= 50 ? 'bg-sky-400' : 'bg-amber-400'
            }`}
            style={{ width: `${percentCollected}%` }}
          />
        </div>
      </div>

      {/* Action banner if active user has dues pending */}
      {isMyDuePending && myCollection && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-sky-500/30 bg-sky-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Your Monthly Contribution</p>
            <p className="mt-0.5 text-sm font-medium text-slate-100">
              Your fixed share of <strong className="text-sky-300">{inr.format(myCollection.amount)}</strong> is due for {current_cycle}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedForPayment(myCollection)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-xs font-semibold text-white shadow-md shadow-blue-950/30 transition-transform active:scale-95"
          >
            Pay {inr.format(myCollection.amount)} <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Roommate Breakdown List */}
      <div className="mt-5 space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Flatmate Status</p>
        <div className="divide-y divide-white/5 rounded-2xl border border-white/5 bg-slate-950/50 px-3">
          {current_budget_collections.map((col) => {
            const member = members.find((m) => m.user_id === col.user_id);
            const isMe = col.user_id === current_user?.user_id;
            const isVerified = col.status === 'VERIFIED';
            const isPaid = col.status === 'PAID';
            const isPending = col.status === 'PENDING';

            return (
              <div key={col.collection_id} className="flex items-center justify-between gap-3 py-3 text-xs">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    isVerified
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isPaid
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {member?.name ? member.name[0].toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-200">
                      {member?.name || col.user_id} {isMe && <span className="text-[10px] text-sky-400 font-normal">(You)</span>}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">{inr.format(col.amount)} · {col.payment_method || 'Monthly quota'}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {col.screenshot_url && (
                    <a
                      href={col.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 underline"
                      title="View payment proof on Google Drive"
                    >
                      Proof <ExternalLink size={11} />
                    </a>
                  )}

                  {isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={12} /> Verified
                    </span>
                  )}

                  {isPaid && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-400 border border-sky-500/20">
                        <Clock size={12} /> Paid
                      </span>
                      {!isMe && (
                        <button
                          type="button"
                          disabled={isVerifyingId === col.collection_id}
                          onClick={() => void handleVerify(col.collection_id)}
                          className="rounded-lg bg-emerald-600/30 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-600/50 transition-colors"
                        >
                          {isVerifyingId === col.collection_id ? '…' : 'Verify'}
                        </button>
                      )}
                    </div>
                  )}

                  {isPending && (
                    isMe ? (
                      <button
                        type="button"
                        onClick={() => setSelectedForPayment(col)}
                        className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
                      >
                        Pay Due
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-400 border border-rose-500/20">
                        <AlertCircle size={12} /> Pending
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedForPayment && (
        <BudgetPaymentSheet
          collection={selectedForPayment}
          onClose={() => setSelectedForPayment(null)}
        />
      )}
    </section>
  );
};

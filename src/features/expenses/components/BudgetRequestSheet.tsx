import React, { useState } from 'react';
import { Banknote, ImagePlus, Send } from 'lucide-react';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import type { Group } from '../../../types/database';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';

export interface BudgetRequestDraft {
  amount: number;
  groupId: string;
  reason: string;
  paymentMethod: 'UPI' | 'CASH';
  screenshot: File | null;
}

interface BudgetRequestSheetProps {
  isOpen: boolean;
  groups: Group[];
  onClose: () => void;
  onSubmit: (draft: BudgetRequestDraft) => Promise<void>;
}

export const BudgetRequestSheet: React.FC<BudgetRequestSheetProps> = ({ isOpen, groups, onClose, onSubmit }) => {
  const [amount, setAmount] = useState('');
  const [groupId, setGroupId] = useState(() => groups.find((group) => group.group_id === 'GRP_ALL')?.group_id ?? groups[0]?.group_id ?? '');
  const [reason, setReason] = useState('');
  const [isCash, setIsCash] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultGroupId = groups.find((group) => group.group_id === 'GRP_ALL')?.group_id ?? groups[0]?.group_id ?? '';
  const selectedGroupId = groupId || defaultGroupId;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestAmount = Number(amount);
    if (!Number.isFinite(requestAmount) || requestAmount <= 0 || !selectedGroupId || !reason.trim()) {
      setError('Enter an amount, choose a group, and add a short reason.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ amount: requestAmount, groupId: selectedGroupId, reason: reason.trim(), paymentMethod: isCash ? 'CASH' : 'UPI', screenshot });
      setAmount('');
      setReason('');
      setScreenshot(null);
      onClose();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save this budget request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveActionSheet title="Raise a budget request" isOpen={isOpen} onClose={onClose} closeDisabled={isSubmitting}>
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-sky-400">Household funding</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Request additional funds</h2>
        <p className="mt-2 text-sm text-zinc-400">Flatmates can review the amount and payment proof.</p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="budget-request-amount" className="mb-2 block text-sm font-medium text-zinc-300">Requested amount</label>
          <div className="flex min-h-14 items-center rounded-xl border border-zinc-800/40 bg-zinc-950 px-4 focus-within:border-sky-400">
            <span className="mr-3 text-zinc-400">₹</span>
            <input id="budget-request-amount" required min="0.01" step="0.01" inputMode="decimal" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="min-w-0 flex-1 bg-transparent font-mono text-lg tabular-nums text-zinc-50 outline-none placeholder:text-zinc-600" />
          </div>
        </div>
        <div>
          <label htmlFor="budget-request-group" className="mb-2 block text-sm font-medium text-zinc-300">Budget group</label>
          <select id="budget-request-group" required value={selectedGroupId} onChange={(event) => setGroupId(event.target.value)} className="min-h-14 w-full rounded-xl border border-zinc-800/40 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:border-sky-400">
            {groups.map((group) => <option key={group.group_id} value={group.group_id}>{group.group_name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="budget-request-reason" className="mb-2 block text-sm font-medium text-zinc-300">Reason</label>
          <textarea id="budget-request-reason" required rows={2} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What is the funding for?" className="w-full resize-none rounded-xl border border-zinc-800/40 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-sky-400" />
        </div>
        <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-800/40 px-4">
          <span className="flex items-center gap-3">
            <Banknote size={19} className={isCash ? 'text-amber-300' : 'text-zinc-400'} aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-zinc-50">Cash payment</span>
              <span className="mt-1 block text-xs text-zinc-400">Requires admin approval</span>
            </span>
          </span>
          <input type="checkbox" checked={isCash} onChange={(event) => setIsCash(event.target.checked)} className="size-5 accent-sky-500" />
        </label>
        {!isCash && (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800/40 bg-zinc-950 px-4 text-sm font-medium text-zinc-300 transition-colors hover:border-sky-400/50 hover:text-zinc-50">
            <ImagePlus size={18} aria-hidden="true" />
            {screenshot ? screenshot.name : 'Add UPI payment screenshot (optional)'}
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)} />
          </label>
        )}
        {isSubmitting && screenshot && (
          <div aria-live="polite" aria-label="Uploading payment screenshot">
            <p className="mb-2 text-xs text-zinc-400">Uploading payment proof…</p>
            <LoadingSkeleton rows={1} />
          </div>
        )}
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <button type="submit" disabled={isSubmitting || !groups.length} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-colors hover:from-blue-500 hover:to-sky-400 disabled:opacity-50">
          <Send size={17} aria-hidden="true" />{isSubmitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>
    </ResponsiveActionSheet>
  );
};

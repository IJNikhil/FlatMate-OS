import React, { useState } from 'react';
import { Banknote, Check, Copy, ExternalLink, ImagePlus, Send } from 'lucide-react';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { triggerHapticFeedback } from '../../../components/ui/haptics';
import { compressImageFile } from '../../../utils/imageCompressor';
import { useAppData } from '../../../services/store/AppDataContext';
import { useToast } from '../../../components/ui/Toast';
import type { BudgetCollection } from '../../../types/database';

interface BudgetPaymentSheetProps {
  collection: BudgetCollection;
  onClose: () => void;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

const isMobileDevice = (): boolean => {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
};

export const BudgetPaymentSheet: React.FC<BudgetPaymentSheetProps> = ({ collection, onClose }) => {
  const { members, groups, payBudgetCollectionOptimistic } = useAppData();
  const { showToast } = useToast();
  const [isCash, setIsCash] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Group and designated collector (default to first active member with UPI or global pool)
  const group = groups.find((g) => g.group_id === collection.group_id);
  const collector = members.find((m) => m.is_active && m.upi_id) ?? members[0];
  const targetUpi = collector?.upi_id || 'flatmate.pool@upi';

  const upiUrl = `upi://pay?pa=${encodeURIComponent(targetUpi)}&pn=${encodeURIComponent(collector?.name || 'Household Pool')}&am=${collection.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Budget dues ${collection.month_cycle}`)}`;

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(targetUpi);
      setCopied(true);
      showToast('UPI address copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let compressedProof = '';
      if (screenshot) {
        compressedProof = await compressImageFile(screenshot);
      }

      await payBudgetCollectionOptimistic(
        collection.collection_id,
        isCash ? 'CASH' : 'UPI',
        compressedProof || undefined
      );

      triggerHapticFeedback(30);
      showToast('Monthly budget payment submitted!', 'success');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record budget payment.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveActionSheet
      title={`Pay ${collection.month_cycle} Budget Dues`}
      isOpen
      onClose={onClose}
      closeDisabled={isSubmitting}
    >
      <header className="mb-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Monthly Contribution</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">{group?.group_name || 'Household Pool'}</h2>
        <p className="mt-1 text-xs text-slate-400">Cycle: {collection.month_cycle}</p>
        <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-slate-50">{inr.format(collection.amount)}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* UPI Payment Options */}
        {!isCash && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Send UPI to: <strong className="text-slate-200">{collector?.name}</strong></span>
              <button
                type="button"
                onClick={copyUpi}
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy UPI'}</span>
              </button>
            </div>

            {isMobileDevice() ? (
              <a
                href={upiUrl}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-transform active:scale-95"
              >
                <ExternalLink size={16} /> Pay ₹{collection.amount} via UPI App
              </a>
            ) : (
              <div className="flex flex-col items-center gap-2 pt-1 text-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`}
                  alt="Scan to pay monthly budget dues"
                  className="rounded-xl border border-zinc-700 bg-white p-2"
                  width={150}
                  height={150}
                />
                <p className="text-[11px] text-zinc-400">Scan using Google Pay, PhonePe, or Paytm</p>
              </div>
            )}
          </div>
        )}

        {/* Cash toggle */}
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/60 px-4">
          <span className="flex items-center gap-3">
            <Banknote size={19} className={isCash ? 'text-amber-400' : 'text-slate-400'} aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-slate-100">Paid in Cash</span>
              <span className="text-xs text-slate-400">Mark as physical cash handover</span>
            </span>
          </span>
          <input
            type="checkbox"
            checked={isCash}
            onChange={(e) => setIsCash(e.target.checked)}
            className="size-5 accent-sky-500"
          />
        </label>

        {/* Screenshot Upload */}
        {!isCash && (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 text-sm font-medium text-zinc-300 transition-colors hover:border-sky-500/50 hover:text-zinc-50">
            <ImagePlus size={18} aria-hidden="true" />
            <span className="truncate">{screenshot ? screenshot.name : 'Attach payment screenshot (optional)'}</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        {isSubmitting && screenshot && (
          <div>
            <p className="mb-2 text-xs text-zinc-400">Compressing &amp; uploading proof to Google Drive…</p>
            <LoadingSkeleton rows={1} />
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Send size={16} aria-hidden="true" />
          {isSubmitting ? 'Recording Payment…' : 'Submit Monthly Dues'}
        </button>
      </form>
    </ResponsiveActionSheet>
  );
};

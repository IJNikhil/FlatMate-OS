import React, { useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import type { Member } from '../../../types/database';
import type { SettlementTransaction } from '../utils/debtSimplifier';
import { generateUpiUrl, isValidUpiAddress } from '../utils/upiDeepLink';
import { settleDebt } from '../../../services/api/gasClient';
import { useAppData } from '../../../services/store/AppDataContext';
import { triggerHapticFeedback } from '../../../components/ui/haptics';

interface PaymentSheetProps {
  transaction: SettlementTransaction;
  debtor: Member;
  creditor: Member;
  onClose: () => void;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

const isMobileDevice = (): boolean => {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
};

export const PaymentSheet: React.FC<PaymentSheetProps> = ({ transaction, debtor, creditor, onClose }) => {
  const { refreshData } = useAppData();
  const [copied, setCopied] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const validUpi = isValidUpiAddress(creditor.upi_id);
  const paymentUrl = validUpi ? generateUpiUrl({
    payeeAddress: creditor.upi_id,
    payeeName: creditor.name,
    amount: transaction.amount,
    transactionNote: 'FlatMate OS settlement',
  }) : undefined;

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(creditor.upi_id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleMarkSettled = async () => {
    setIsSettling(true);
    setSettleError(null);
    try {
      await settleDebt({
        payee_id: creditor.user_id,
        amount: transaction.amount,
      });
      triggerHapticFeedback();
      await refreshData();
      onClose();
    } catch (err: unknown) {
      setSettleError(err instanceof Error ? err.message : 'Failed to record debt settlement.');
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <ResponsiveActionSheet title="Settle payment" isOpen onClose={onClose}>
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-sky-400">Settlement</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-50">Complete your payment</h2>
      </header>
      <div className="my-7 border-y border-zinc-800/40 py-5 text-center">
        <p className="text-sm text-zinc-400">{debtor.name} pays {creditor.name}</p>
        <p className="mt-3 font-mono text-4xl font-semibold tabular-nums tracking-tight text-zinc-50">{inr.format(transaction.amount)}</p>
        <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-zinc-800/70 px-3 py-2 text-xs text-zinc-300">
          <span className="truncate">{creditor.upi_id || 'UPI ID not available'}</span>
          {validUpi && (
            <button type="button" onClick={() => void copyUpi()} aria-label="Copy UPI ID" className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-400">
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </button>
          )}
        </div>
        {copied && <p className="mt-2 text-xs text-emerald-400">UPI ID copied</p>}
      </div>

      <div className="space-y-3">
        {paymentUrl ? (
          isMobileDevice() ? (
            <a
              href={paymentUrl}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-transform hover:from-blue-500 hover:to-sky-400 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <ExternalLink size={17} aria-hidden="true" /> Pay via UPI App
            </a>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950 p-4 text-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(paymentUrl)}`}
                alt="Scan to pay via UPI"
                className="rounded-xl border border-zinc-700 bg-white p-2 shadow-inner"
                width={160}
                height={160}
              />
              <div>
                <p className="text-xs font-medium text-zinc-300">Scan with Google Pay, PhonePe, or Paytm</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">Or use the copied UPI address above</p>
              </div>
            </div>
          )
        ) : (
          <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-center text-sm text-amber-300">A valid UPI ID is not configured for {creditor.name}.</p>
        )}

        <button
          type="button"
          onClick={handleMarkSettled}
          disabled={isSettling}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-900/50 disabled:opacity-50"
        >
          <Check size={16} aria-hidden="true" />
          {isSettling ? 'Recording settlement…' : 'Mark Debt as Settled'}
        </button>
        {settleError && <p role="alert" className="text-center text-xs text-rose-400">{settleError}</p>}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
        <span>{debtor.name}</span><ArrowRight size={13} aria-hidden="true" /><span>{creditor.name}</span>
      </div>
    </ResponsiveActionSheet>
  );
};

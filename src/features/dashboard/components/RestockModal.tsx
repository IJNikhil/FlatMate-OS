import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { addExpense, updateStockStatus } from '../../../services/api/gasClient';
import { useAppData } from '../../../services/store/AppDataContext';
import type { InventoryItem } from '../../../types/database';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import { triggerHapticFeedback } from '../../../components/ui/haptics';

interface RestockModalProps {
  item: InventoryItem;
  onClose: () => void;
}

export const RestockModal: React.FC<RestockModalProps> = ({ item, onClose }) => {
  const { members, refreshData } = useAppData();
  const activeMembers = members.filter((member) => member.is_active);
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(() => activeMembers[0]?.user_id ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !paidBy) {
      setError('Enter a valid cost and choose who paid.');
      return;
    }

    setIsSaving(true);
    setError(null);
    const operations = await Promise.allSettled([
      updateStockStatus(item.item_id, 'IN_STOCK', paidBy),
      addExpense({
        item_id: item.item_id,
        group_id: item.group_id,
        paid_by: paidBy,
        amount: numericAmount,
      }),
    ]);

    const succeeded = operations.filter((result) => result.status === 'fulfilled').length;
    if (succeeded > 0) await refreshData();

    if (succeeded !== operations.length) {
      setError(succeeded === 1
        ? 'One update succeeded, but the other failed. Check the latest data before retrying.'
        : 'Could not save this restock. Please check your connection and try again.');
      setIsSaving(false);
      return;
    }

    triggerHapticFeedback();
    setIsSaving(false);
    onClose();
  };

  return (
    <ResponsiveActionSheet
      isOpen
      title={`Restock ${item.item_name}`}
      onClose={onClose}
      closeDisabled={isSaving}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-emerald-400">Restock item</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-50">{item.item_name}</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="restock-cost" className="mb-2 block text-sm font-medium text-zinc-300">Total cost</label>
          <div className="flex min-h-14 items-center rounded-xl border border-zinc-800/50 bg-black px-4 focus-within:border-sky-500">
            <span className="mr-3 text-zinc-400">₹</span>
            <input
              id="restock-cost"
              autoFocus
              required
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent font-mono text-lg tabular-nums text-zinc-50 outline-none placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="restock-payer" className="mb-2 block text-sm font-medium text-zinc-300">Paid by</label>
          <select
            id="restock-payer"
            required
            value={paidBy}
            onChange={(event) => setPaidBy(event.target.value)}
            className="min-h-14 w-full rounded-xl border border-zinc-800/50 bg-black px-4 text-sm text-zinc-50 outline-none focus:border-sky-500"
          >
            {activeMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
          </select>
        </div>

        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={isSaving || activeMembers.length === 0}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={17} aria-hidden="true" />
          {isSaving ? 'Saving restock…' : 'Confirm restock'}
        </button>
      </form>
    </ResponsiveActionSheet>
  );
};

import React, { useState } from 'react';
import { Check, PackageCheck } from 'lucide-react';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';

import { useAppData } from '../../../services/store/AppDataContext';
import type { InventoryItem, StockStatus } from '../../../types/database';


interface UpdateStockSheetProps {
  item: InventoryItem;
  onClose: () => void;
}

const options: Array<{ value: StockStatus; label: string; description: string; icon: string; tint: string }> = [
  { value: 'IN_STOCK', label: 'In stock', description: 'Available in the pantry', icon: 'text-emerald-400', tint: 'bg-emerald-500/15' },
  { value: 'LOW_STOCK', label: 'Running low', description: 'Add it to the next shop', icon: 'text-amber-400', tint: 'bg-amber-500/15' },
  { value: 'OUT_OF_STOCK', label: 'Empty', description: 'Needs to be replenished', icon: 'text-rose-400', tint: 'bg-rose-500/15' },
];

export const UpdateStockSheet: React.FC<UpdateStockSheetProps> = ({ item, onClose }) => {
  const { updateStockStatusOptimistic } = useAppData();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectStatus = async (status: StockStatus) => {
    if (isSaving || item.current_status === status) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateStockStatusOptimistic(item.item_id, status);


      onClose();
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update pantry stock.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ResponsiveActionSheet
      title={`Update ${item.item_name} stock`}
      isOpen
      onClose={onClose}
      closeDisabled={isSaving}
    >
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-sky-400">Pantry status</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-50">{item.item_name}</h2>
        <p className="mt-1 text-sm text-zinc-400">Choose the current stock level</p>
      </header>
      <div className="space-y-2">
        {options.map((option) => {
          const isSelected = item.current_status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              disabled={isSaving}
              onClick={() => void selectStatus(option.value)}
              className="flex min-h-[72px] w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-zinc-800/70 active:bg-zinc-800 disabled:opacity-60"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${option.tint}`}>
                {isSelected ? <Check size={18} className={option.icon} aria-hidden="true" /> : <PackageCheck size={18} className={option.icon} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-50">{option.label}</span>
                <span className="mt-1 block text-sm text-zinc-400">{option.description}</span>
              </span>
              {isSaving && <span className="text-xs text-zinc-400">Saving…</span>}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-400">{error}</p>}
    </ResponsiveActionSheet>
  );
};

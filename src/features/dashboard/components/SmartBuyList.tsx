import React, { useMemo, useState } from 'react';
import { ArrowRight, ShoppingBasket } from 'lucide-react';
import { useAppData } from '../../../services/store/AppDataContext';
import type { InventoryItem } from '../../../types/database';
import { RestockModal } from './RestockModal';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';

const statusLabel: Record<InventoryItem['current_status'], string> = {
  OUT_OF_STOCK: 'Out of stock',
  LOW_STOCK: 'Low stock',
  IN_STOCK: 'In stock',
};

export const SmartBuyList: React.FC = () => {
  const { inventory, isLoading } = useAppData();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const buyList = useMemo(() => inventory
    .filter((item) => item.current_status !== 'IN_STOCK')
    .sort((a, b) => {
      if (a.is_essential !== b.is_essential) return a.is_essential ? -1 : 1;
      if (a.current_status !== b.current_status) {
        return a.current_status === 'OUT_OF_STOCK' ? -1 : 1;
      }
      return a.item_name.localeCompare(b.item_name);
    }), [inventory]);

  return (
    <section aria-labelledby="smart-buy-list-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">For the household</p>
          <h2 id="smart-buy-list-heading" className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Smart Buy List</h2>
        </div>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
          {buyList.length} {buyList.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {isLoading && inventory.length === 0 ? (
        <LoadingSkeleton rows={3} />
      ) : buyList.length === 0 ? (
        <div className="py-8 text-center">
          <ShoppingBasket className="mx-auto mb-3 text-zinc-500" size={23} aria-hidden="true" />
          <p className="text-sm text-zinc-500">Everything is stocked. No shopping needed.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/40">
          {buyList.map((item) => (
            <li key={item.item_id}>
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                aria-label={`Restock ${item.item_name}`}
                className="flex min-h-20 w-full cursor-pointer items-center justify-between gap-4 px-2 py-5 text-left transition-colors active:bg-zinc-900/50 focus-visible:outline-2 focus-visible:outline-sky-500"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-zinc-50">{item.item_name}</h3>
                    {item.is_essential && <span className="shrink-0 text-xs text-amber-400">Essential</span>}
                  </div>
                  <p className={`mt-1 text-sm ${item.current_status === 'OUT_OF_STOCK' ? 'text-rose-400' : 'text-amber-400'}`}>
                    {statusLabel[item.current_status]}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-emerald-400">
                  Bought <ArrowRight size={16} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedItem && (
        <RestockModal
          key={selectedItem.item_id}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </section>
  );
};

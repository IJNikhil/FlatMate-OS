import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, PackageOpen, PackageX, Plus } from 'lucide-react';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { SwipeActionRow } from '../../../components/ui/SwipeActionRow';


import { useAppData } from '../../../services/store/AppDataContext';
import type { Group, InventoryItem } from '../../../types/database';
import { AddItemSheet } from './AddItemSheet';
import { UpdateStockSheet } from './UpdateStockSheet';
import { getMemberGroupIds } from '../../groups/utils/membership';

export const PantryView: React.FC = () => {
  const { inventory, groups, members, member_groups, isLoading, updateStockStatusOptimistic } = useAppData();
  const activeMember = members.find((member) => member.is_active);
  const memberGroupIds = getMemberGroupIds(activeMember?.user_id, member_groups);
  const visibleGroups = groups.filter((group) => memberGroupIds.has(group.group_id));
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemsByGroup = useMemo(() => {
    const grouped = new Map<string, InventoryItem[]>();
    inventory.forEach((item) => grouped.set(item.group_id, [...(grouped.get(item.group_id) ?? []), item]));
    return grouped;
  }, [inventory]);

  const items = selectedGroup ? (itemsByGroup.get(selectedGroup.group_id) ?? []) : [];

  const markEmpty = async (item: InventoryItem) => {
    if (updatingId) return;
    setUpdatingId(item.item_id);
    setError(null);
    try {
      await updateStockStatusOptimistic(item.item_id, 'OUT_OF_STOCK');


    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update pantry stock.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="pantry-title">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
        {selectedGroup ? (
          <>
            <button
              type="button"
              onClick={() => { setSelectedGroup(null); setError(null); }}
              className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl pr-3 text-sm font-medium text-slate-400 transition-colors hover:text-slate-50 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              <ArrowLeft size={17} aria-hidden="true" /> Back to Groups
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Pantry group</p>
            <h2 id="pantry-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">{selectedGroup.group_name}</h2>
            <p className="mt-1 text-sm text-slate-400">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Inventory overview</p>
            <h2 id="pantry-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Kitchen Pantry</h2>
            <p className="mt-1 text-sm text-slate-400">Choose a group to view its items.</p>
          </>
        )}
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add pantry item"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 px-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition-colors hover:from-blue-500 hover:to-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          <Plus size={18} aria-hidden="true" /><span className="hidden min-[360px]:inline">Add item</span>
        </button>
      </header>

      {error && <p role="alert" className="mb-4 text-sm text-rose-400">{error}</p>}
      {isLoading && inventory.length === 0 ? (
        <LoadingSkeleton rows={5} />
      ) : selectedGroup ? (
        items.length === 0 ? (
          <div className="py-10 text-center">
            <PackageOpen size={24} className="mx-auto mb-3 text-slate-500" aria-hidden="true" />
            <p className="text-sm text-slate-500">No items in this group yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {items.map((item) => (
              <li key={item.item_id}>
                <SwipeActionRow
                  direction="right"
                  label="Empty"
                  icon={PackageX}
                  tone="rose"
                  disabled={updatingId === item.item_id}
                  onAction={() => void markEmpty(item)}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="flex min-h-20 w-full cursor-pointer items-center justify-between gap-4 px-2 py-5 text-left transition-colors active:bg-slate-900/50 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span
                          aria-label={item.current_status === 'IN_STOCK' ? 'In stock' : item.current_status === 'LOW_STOCK' ? 'Low stock' : 'Empty'}
                          className={`size-2 shrink-0 rounded-full ${item.current_status === 'IN_STOCK' ? 'animate-pulse bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.35)]' : item.current_status === 'LOW_STOCK' ? 'bg-amber-400' : 'bg-rose-500'}`}
                        />
                        <span className="truncate text-sm font-medium text-slate-50">{item.item_name}</span>
                        {item.is_essential && <span className="shrink-0 text-xs text-amber-400">Essential</span>}
                      </span>
                      <span className="mt-1 block pl-4 text-sm text-slate-400">{item.current_status === 'IN_STOCK' ? 'In stock' : item.current_status === 'LOW_STOCK' ? 'Low stock' : 'Empty'}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
                  </button>
                </SwipeActionRow>
              </li>
            ))}
          </ul>
        )
      ) : visibleGroups.length === 0 ? (
        <div className="py-10 text-center">
          <PackageOpen size={24} className="mx-auto mb-3 text-slate-500" aria-hidden="true" />
          <p className="text-sm text-slate-500">No pantry groups are available.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleGroups.map((group) => {
            const groupItems = itemsByGroup.get(group.group_id) ?? [];
            const needsRestock = groupItems.filter((item) => item.current_status !== 'IN_STOCK').length;
            return (
              <li key={group.group_id}>
                <button
                  type="button"
                  onClick={() => setSelectedGroup(group)}
                  className="flex min-h-24 w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/75 px-5 py-5 text-left shadow-lg shadow-black/10 backdrop-blur-xl transition-colors hover:border-sky-400/30 hover:bg-slate-900 active:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-base font-semibold leading-snug text-slate-50">{group.group_name}</span>
                    <span className="mt-1 block text-sm text-slate-400">{groupItems.length} {groupItems.length === 1 ? 'item' : 'items'}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {needsRestock > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300">{needsRestock} low</span>}
                    <ArrowRight size={18} className="text-slate-500" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AddItemSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} availableGroupIds={memberGroupIds} />
      {selectedItem && <UpdateStockSheet item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </section>
  );
};

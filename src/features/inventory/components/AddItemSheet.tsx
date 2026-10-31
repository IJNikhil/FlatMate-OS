import React, { useMemo, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { addInventoryItem } from '../../../services/api/gasClient';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import { useAppData } from '../../../services/store/AppDataContext';
import { triggerHapticFeedback } from '../../../components/ui/haptics';
import type { Group } from '../../../types/database';

interface AddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  availableGroupIds?: Set<string>;
}

function createItemId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ITM_${Date.now()}`;
}

export const AddItemSheet: React.FC<AddItemSheetProps> = ({ isOpen, onClose, availableGroupIds }) => {
  const { groups, inventory, refreshData } = useAppData();
  const groupOptions: Group[] = availableGroupIds
    ? groups.filter((group) => availableGroupIds.has(group.group_id))
    : groups;
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isEssential, setIsEssential] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duplicateItem = useMemo(() => {
    const normalizedName = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (!normalizedName) return undefined;
    return inventory.find((item) => item.item_name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName);
  }, [inventory, name]);
  const duplicateGroupName = duplicateItem
    ? groups.find((group) => group.group_id === duplicateItem.group_id)?.group_name ?? duplicateItem.group_id
    : '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !groupId) return;

    setIsSaving(true);
    setError(null);
    try {
      await addInventoryItem({
        item_id: createItemId(),
        item_name: name.trim(),
        group_id: groupId,
        is_essential: isEssential,
        current_status: 'IN_STOCK',
      });
      await refreshData();
      triggerHapticFeedback();
      setName('');
      setIsEssential(false);
      onClose();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Could not add this item.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ResponsiveActionSheet
      title="Add pantry item"
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSaving}
    >
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-sky-400">Pantry</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Add an item</h2>
      </header>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="new-item-name" className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">Item name</label>
          <input
            id="new-item-name"
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="What do you need?"
            className="min-h-16 w-full border-b border-zinc-800/50 bg-transparent px-1 text-xl text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-sky-500"
          />
        </div>
        {duplicateItem && (
          <div role="status" className="flex gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
            <p className="text-sm leading-relaxed">
              Heads up: <span className="font-semibold">{duplicateItem.item_name}</span> is already in <span className="font-semibold">{duplicateGroupName}</span>.
              You can still continue and add it to the selected group.
            </p>
          </div>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Assign to group</legend>
          {groupOptions.map((group) => (
            <label key={group.group_id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 transition-colors ${groupId === group.group_id ? 'bg-zinc-800/70' : 'hover:bg-zinc-900'}`}>
              <input
                type="radio"
                name="new-item-group"
                required
                value={group.group_id}
                checked={groupId === group.group_id}
                onChange={() => setGroupId(group.group_id)}
                className="size-4 accent-sky-500"
              />
              <span className="text-sm font-medium text-zinc-50">{group.group_name}</span>
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={isEssential}
            onChange={(event) => setIsEssential(event.target.checked)}
            className="size-5 accent-amber-500"
          />
          Mark as an essential item
        </label>
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={isSaving || groupOptions.length === 0}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-colors hover:from-blue-500 hover:to-sky-400 disabled:opacity-50"
        >
          <Plus size={17} aria-hidden="true" />
          {isSaving ? 'Adding item…' : 'Add to pantry'}
        </button>
      </form>
    </ResponsiveActionSheet>
  );
};

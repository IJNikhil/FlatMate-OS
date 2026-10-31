import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { addExpense } from '../../../services/api/gasClient';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import { useAppData } from '../../../services/store/AppDataContext';
import { triggerHapticFeedback } from '../../../components/ui/haptics';
import type { Group } from '../../../types/database';

interface ExpenseEntrySheetProps {
  isOpen: boolean;
  onClose: () => void;
  groups?: Group[];
}

export const ExpenseEntrySheet: React.FC<ExpenseEntrySheetProps> = ({ isOpen, onClose, groups: propGroups }) => {
  const { members, groups: contextGroups, inventory, refreshData, current_user } = useAppData();
  const groups = propGroups ?? contextGroups;
  const activeMembers = members.filter((member) => member.is_active);
  const activeUserId = current_user?.user_id ?? activeMembers[0]?.user_id ?? '';
  const commonGroup = groups.find((group) => group.group_id === 'GRP_ALL'
    || /common house|global household/i.test(group.group_name));
  const [amount, setAmount] = useState('');
  const [itemName, setItemName] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groupManuallySelected, setGroupManuallySelected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPayer = paidBy || activeUserId;
  const selectedGroup = groupId || commonGroup?.group_id || groups[0]?.group_id || '';

  const handleItemNameChange = (value: string) => {
    setItemName(value);
    if (groupManuallySelected || !commonGroup) return;
    const normalized = value.trim().toLocaleLowerCase();
    if (normalized.length < 3) return;
    const knownStaple = inventory.find((item) => item.is_essential
      && item.item_name.toLocaleLowerCase().includes(normalized));
    if (knownStaple && knownStaple.group_id === commonGroup.group_id) {
      setGroupId(commonGroup.group_id);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !itemName.trim() || !selectedPayer || !selectedGroup) {
      setError('Complete each field with a valid amount.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await addExpense({ item_id: itemName.trim(), amount: value, paid_by: selectedPayer, group_id: selectedGroup });
      await refreshData();
      triggerHapticFeedback();
      setAmount('');
      setItemName('');
      onClose();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save this expense.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ResponsiveActionSheet title="Log an expense" isOpen={isOpen} onClose={onClose} closeDisabled={isSaving}>
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-sky-400">Expense ledger</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-50">Log an expense</h2>
      </header>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="expense-amount" className="mb-2 block text-sm font-medium text-zinc-300">Amount</label>
          <div className="flex min-h-14 items-center rounded-xl border border-zinc-800/50 bg-black px-4 focus-within:border-sky-500">
            <span className="mr-3 text-zinc-400">₹</span>
            <input id="expense-amount" required min="0.01" step="0.01" inputMode="decimal" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="min-w-0 flex-1 bg-transparent font-mono text-lg tabular-nums text-zinc-50 outline-none placeholder:text-zinc-500" />
          </div>
        </div>
        <div>
          <label htmlFor="expense-item-name" className="mb-2 block text-sm font-medium text-zinc-300">Item or description</label>
            <input id="expense-item-name" required maxLength={150} value={itemName} onChange={(event) => handleItemNameChange(event.target.value)} placeholder="e.g. Weekly groceries" className="min-h-14 w-full rounded-xl border border-zinc-800/50 bg-black px-4 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-sky-500" />
        </div>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <div>
            <label htmlFor="expense-paid-by" className="mb-2 block text-sm font-medium text-zinc-300">Paid by</label>
            <select id="expense-paid-by" required value={selectedPayer} onChange={(event) => setPaidBy(event.target.value)} className="min-h-14 w-full rounded-xl border border-zinc-800/50 bg-black px-3 text-sm text-zinc-50 outline-none focus:border-sky-500">
              {activeMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="expense-group" className="mb-2 block text-sm font-medium text-zinc-300">Split group</label>
            <select id="expense-group" required value={selectedGroup} onChange={(event) => { setGroupId(event.target.value); setGroupManuallySelected(true); }} className="min-h-14 w-full rounded-xl border border-zinc-800/50 bg-black px-3 text-sm text-zinc-50 outline-none focus:border-sky-500">
              {groups.map((group) => <option key={group.group_id} value={group.group_id}>{group.group_name}</option>)}
            </select>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <button type="submit" disabled={isSaving || !activeMembers.length || !groups.length} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-colors hover:from-blue-500 hover:to-sky-400 disabled:opacity-50">
          <Plus size={17} aria-hidden="true" />{isSaving ? 'Saving expense…' : 'Save expense'}
        </button>
      </form>
    </ResponsiveActionSheet>
  );
};

import React, { useState } from 'react';
import { Check, UsersRound } from 'lucide-react';
import type { Group } from '../../../types/database';
import { triggerHapticFeedback } from '../../../components/ui/haptics';

interface GroupSelectionFormProps {
  groups: Group[];
  submitLabel: string;
  onSubmit: (groupIds: string[]) => Promise<void>;
}

export const GroupSelectionForm: React.FC<GroupSelectionFormProps> = ({ groups, submitLabel, onSubmit }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleGroup = (groupId: string) => {
    setSelectedIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(selectedIds);
      triggerHapticFeedback(25);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Could not update group membership.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 text-center">
          <p className="text-sm text-zinc-300">You are enrolled in the Global Household pool.</p>
          <p className="mt-1 text-xs text-zinc-400">Additional subgroups can also be created or joined later.</p>
        </div>
      ) : (
        <fieldset className="divide-y divide-zinc-800/40">
          <legend className="mb-2 text-sm font-medium text-zinc-300">Choose optional subgroup pools</legend>
          {groups.map((group) => {
            const selected = selectedIds.includes(group.group_id);
            return (
              <label
                key={group.group_id}
                className={`flex min-h-16 cursor-pointer items-center gap-3 px-2 py-2 transition-colors ${
                  selected ? 'text-sky-200' : 'text-zinc-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleGroup(group.group_id)}
                  className="peer sr-only"
                />
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    selected ? 'bg-sky-500/15 text-sky-400' : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {selected ? <Check size={18} aria-hidden="true" /> : <UsersRound size={18} aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-50">{group.group_name}</span>
                  <span className="mt-1 block font-mono text-xs tabular-nums text-zinc-400">
                    Monthly budget · ₹{group.budget_target.toLocaleString('en-IN')}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`size-4 rounded-full border ${
                    selected ? 'border-sky-400 bg-sky-400 ring-2 ring-sky-400/20' : 'border-zinc-700'
                  }`}
                />
              </label>
            );
          })}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-14 w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-colors hover:from-blue-500 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? 'Saving…'
          : selectedIds.length > 0
          ? `${submitLabel} (${selectedIds.length} selected)`
          : 'Continue to Home Dashboard'}
      </button>
    </form>
  );
};

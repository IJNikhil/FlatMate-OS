import React from 'react';
import { Check, Home, ShieldCheck } from 'lucide-react';
import type { Group } from '../../../types/database';
import { GroupSelectionForm } from '../../groups/components/GroupSelectionForm';

interface OnboardingProps {
  displayName: string;
  groups: Group[];
  onJoinGroups: (groupIds: string[]) => Promise<void>;
}

export const Onboarding: React.FC<OnboardingProps> = ({ displayName, groups, onJoinGroups }) => {
  const subgroupChoices = groups.filter((group) => group.group_id !== 'GRP_ALL');

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center bg-zinc-950 px-4 py-8 pb-safe text-zinc-50">
      <div className="mb-8 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-xl shadow-blue-950/40">
        <Home size={25} aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Welcome to FlatMate OS</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-50">Welcome home, {displayName}!</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Your Google account has been recognized. You have already been enrolled in the shared Global Household pool.
      </p>

      <div className="my-7 flex items-start gap-3 rounded-2xl bg-emerald-900/30 p-4 ring-1 ring-emerald-500/20">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-400">
          <Check size={17} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-emerald-300">Global Household Joined</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">Shared household expenses and inventory are active for you.</p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck size={17} className="text-sky-400" aria-hidden="true" />
        <h2 className="text-base font-semibold text-zinc-50">Optional Subgroup Pools</h2>
      </div>
      <p className="mb-5 text-sm text-zinc-400">
        Select any subgroup pools you participate in, or continue directly to your home dashboard.
      </p>

      <GroupSelectionForm groups={subgroupChoices} submitLabel="Finish Setup" onSubmit={onJoinGroups} />
    </main>
  );
};

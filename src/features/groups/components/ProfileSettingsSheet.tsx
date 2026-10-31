import React, { useState } from 'react';
import { ArrowLeft, UsersRound, LogOut, Mail, CreditCard, Shield } from 'lucide-react';
import { ResponsiveActionSheet } from '../../../components/ui/ResponsiveActionSheet';
import type { Group } from '../../../types/database';
import { GroupSelectionForm } from './GroupSelectionForm';
import { triggerHapticFeedback } from '../../../components/ui/haptics';
import { useAppData } from '../../../services/store/AppDataContext';
import { useToast } from '../../../components/ui/Toast';

interface ProfileSettingsSheetProps {
  isOpen: boolean;
  displayName: string;
  availableGroups: Group[];
  onClose: () => void;
  onJoinGroups: (groupIds: string[]) => Promise<void>;
}

export const ProfileSettingsSheet: React.FC<ProfileSettingsSheetProps> = ({
  isOpen,
  displayName,
  availableGroups,
  onClose,
  onJoinGroups,
}) => {
  const { current_user, logout } = useAppData();
  const { showToast } = useToast();
  const [isJoiningGroups, setIsJoiningGroups] = useState(false);

  const handleLogout = () => {
    triggerHapticFeedback(25);
    logout();
    showToast('Logged out of FlatMate OS.', 'info');
    onClose();
  };

  return (
    <ResponsiveActionSheet title="Profile and settings" isOpen={isOpen} onClose={onClose}>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Your profile</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{displayName}</h2>
        <p className="mt-1 text-xs text-zinc-400">Account and household settings</p>
      </header>

      {/* Active User Card */}
      {current_user && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Mail size={14} className="text-sky-400 shrink-0" />
            <span className="truncate">{current_user.email || 'No email associated'}</span>
          </div>
          {current_user.upi_id && (
            <div className="flex items-center gap-2 text-slate-300">
              <CreditCard size={14} className="text-emerald-400 shrink-0" />
              <span className="truncate">UPI: {current_user.upi_id}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-400 pt-1">
            <Shield size={14} className="text-sky-400 shrink-0" />
            <span>ID: <code className="font-mono text-slate-300">{current_user.user_id}</code></span>
          </div>
        </div>
      )}

      {isJoiningGroups ? (
        <div>
          <button
            type="button"
            onClick={() => setIsJoiningGroups(false)}
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-50"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Profile settings
          </button>
          <GroupSelectionForm groups={availableGroups} submitLabel="Join selected groups" onSubmit={onJoinGroups} />
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { triggerHapticFeedback(); setIsJoiningGroups(true); }}
            disabled={!availableGroups.length}
            className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 text-left transition-colors hover:bg-slate-900 disabled:opacity-50"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-400">
              <UsersRound size={19} aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-zinc-50">Join New Group</span>
              <span className="mt-0.5 block text-xs text-zinc-400">Join another household subgroup</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-950/30 px-4 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-950/60 active:scale-95"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Switch FlatMate / Log out</span>
          </button>
        </div>
      )}
    </ResponsiveActionSheet>
  );
};

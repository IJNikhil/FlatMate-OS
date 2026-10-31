import React, { useEffect, useState } from 'react';
import { useAppData } from '../../services/store/AppDataContext';
import { Wifi, WifiOff } from 'lucide-react';
import { ProfileSettingsSheet } from '../../features/groups/components/ProfileSettingsSheet';
import { joinGroups } from '../../services/api/gasClient';
import { triggerHapticFeedback } from '../ui/haptics';

export const Header: React.FC = () => {
  const { isLoading, error, groups, current_user, refreshData } = useAppData();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const activeUser = current_user;
  const initials = activeUser?.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FM';
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );

  useEffect(() => {
    const updateConnectionStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
    };
  }, []);

  const handleJoinGroups = async (groupIds: string[]) => {
    await joinGroups(groupIds);
    await refreshData();
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full flex-none border-b border-white/10 bg-slate-900/75 px-4 pt-safe pb-3 text-slate-50 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 pt-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-sm font-bold text-white shadow-lg shadow-blue-950/40">
              FM
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-slate-50">FlatMate OS</h1>
              <p className="hidden truncate text-xs text-slate-400 sm:block">Shared home, in sync</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isLoading && <span className="hidden text-xs text-slate-400 sm:inline">Syncing</span>}
            <span
              role="status"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                isOnline
                  ? 'border-emerald-400/20 bg-emerald-900/30 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.08)]'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
              }`}
            >
              {isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
              <span className="hidden min-[380px]:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setIsProfileOpen(true);
              }}
              aria-label={`Active user: ${activeUser?.name ?? 'FlatMate'}. Tap for profile settings.`}
              title={`Active user: ${activeUser?.name ?? 'FlatMate'}`}
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-slate-800 text-sm font-semibold text-slate-50 transition-colors hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {initials}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-xs text-rose-400" role="alert">
            {error}
          </div>
        )}
      </header>

      <ProfileSettingsSheet
        isOpen={isProfileOpen}
        displayName={activeUser?.name ?? 'FlatMate'}
        availableGroups={groups.filter((group) => group.group_id !== 'GRP_ALL')}
        onClose={() => setIsProfileOpen(false)}
        onJoinGroups={handleJoinGroups}
      />
    </>
  );
};

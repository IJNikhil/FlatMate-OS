import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Header } from './Header';
import { BottomNav, type AppTab } from './BottomNav';
import { PantryView } from '../../features/inventory/components/PantryView';
import { HomeDashboard } from '../../features/dashboard/HomeDashboard';
import { ExpenseLedger } from '../../features/expenses/components/ExpenseLedger';
import { SettlementHub } from '../../features/settlements/components/SettlementHub';
import { Onboarding } from '../../features/onboarding/components/Onboarding';
import { LoginScreen } from '../../features/auth/components/LoginScreen';
import { TabErrorBoundary } from '../ui/TabErrorBoundary';
import { useToast } from '../ui/Toast';
import { useAppData } from '../../services/store/AppDataContext';
import { getMemberGroupIds } from '../../features/groups/utils/membership';
import { joinGroups } from '../../services/api/gasClient';
import { getQueuedMutationCount } from '../../services/api/offlineQueue';

export const Shell: React.FC = () => {
  const { current_user, groups, member_groups, isLoading, refreshData } = useAppData();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AppTab>('buy-list');
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const queuedCount = await getQueuedMutationCount();
      if (queuedCount > 0) {
        showToast(`Back online: syncing ${queuedCount} pending action${queuedCount > 1 ? 's' : ''}…`, 'info');
      } else {
        showToast('Internet connection restored.', 'success');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Actions will be queued locally.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // If no user is logged in or selected, show Login Screen
  if (!isLoading && !current_user) {
    return <LoginScreen />;
  }

  const activeUser = current_user;
  const userGroups = activeUser ? getMemberGroupIds(activeUser.user_id, member_groups) : new Set<string>();

  const needsOnboarding = Boolean(
    !isLoading &&
    activeUser &&
    !onboardingDismissed &&
    userGroups.size <= 1 &&
    typeof window !== 'undefined' &&
    !localStorage.getItem(`onboarded_${activeUser.user_id}`)
  );

  const handleJoinGroups = async (groupIds: string[]) => {
    // 1. Immediately mark onboarded locally so the user transitions to dashboard without blocking
    if (activeUser) {
      localStorage.setItem(`onboarded_${activeUser.user_id}`, 'true');
    }
    setOnboardingDismissed(true);
    showToast('Welcome to FlatMate OS!', 'success');

    // 2. Dispatch to backend in background (queued if offline/CORS)
    if (groupIds.length > 0) {
      try {
        await joinGroups(groupIds);
        await refreshData();
      } catch (err) {
        console.warn('[Shell] Group enrollment queued for background sync:', err);
      }
    }
  };

  if (needsOnboarding && activeUser) {
    return (
      <Onboarding
        displayName={activeUser.name}
        groups={groups}
        onJoinGroups={handleJoinGroups}
      />
    );
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-slate-950 text-slate-50">
      <Header />

      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-300"
        >
          <WifiOff size={13} className="shrink-0" />
          <span>Offline mode — updates will sync automatically once reconnected.</span>
        </div>
      )}

      <main className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-4 pt-5 pb-6 scrollbar-hide overscroll-y-contain">
        {activeTab === 'buy-list' && (
          <TabErrorBoundary fallbackTitle="Could not load Buy List">
            <HomeDashboard />
          </TabErrorBoundary>
        )}
        {activeTab === 'pantry' && (
          <TabErrorBoundary fallbackTitle="Could not load Pantry">
            <PantryView />
          </TabErrorBoundary>
        )}
        {activeTab === 'expenses' && (
          <TabErrorBoundary fallbackTitle="Could not load Expenses">
            <ExpenseLedger />
          </TabErrorBoundary>
        )}
        {activeTab === 'settlements' && (
          <TabErrorBoundary fallbackTitle="Could not load Settlements">
            <SettlementHub />
          </TabErrorBoundary>
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

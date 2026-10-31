import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  fetchAllDatabase,
  mutateDatabase,
  updateStockStatus,
  payBudgetCollection,
  verifyBudgetCollection
} from '../api/gasClient';
import { flushMutationQueue } from '../api/offlineQueue';
import { triggerHapticFeedback } from '../../components/ui/haptics';
import type {
  Member,
  Group,
  MemberGroupMapping,
  InventoryItem,
  ExpenseLog,
  StockEvent,
  BudgetRequest,
  BudgetCollection,
  SettlementLog,
  DatabasePayload
} from '../../types/database';

interface AppState {
  current_user: Member | null;
  current_cycle: string;
  members: Member[];
  groups: Group[];
  member_groups: MemberGroupMapping[];
  inventory: InventoryItem[];
  expenses: ExpenseLog[];
  current_expenses: ExpenseLog[];
  historical_expenses: ExpenseLog[];
  stock_events: StockEvent[];
  budget_requests: BudgetRequest[];
  budget_collections: BudgetCollection[];
  current_budget_collections: BudgetCollection[];
  historical_budget_collections: BudgetCollection[];
  settlements: SettlementLog[];
  current_settlements: SettlementLog[];
  historical_settlements: SettlementLog[];
  isLoading: boolean;
  error: string | null;
  refreshData: (options?: { bypassCache?: boolean }) => Promise<void>;
  updateStockStatusOptimistic: (itemId: string, newStatus: InventoryItem['current_status']) => Promise<void>;
  payBudgetCollectionOptimistic: (collectionId: string, paymentMethod: 'UPI' | 'CASH', screenshotBase64?: string) => Promise<void>;
  verifyBudgetCollectionOptimistic: (collectionId: string) => Promise<void>;
  loginAsUser: (member: Member) => Promise<void>;
  logout: () => void;
}

const defaultData: DatabasePayload = {
  current_user: null,
  current_cycle: '',
  members: [],
  groups: [],
  member_groups: [],
  inventory: [],
  expenses: [],
  current_expenses: [],
  historical_expenses: [],
  stock_events: [],
  budget_requests: [],
  budget_collections: [],
  current_budget_collections: [],
  historical_budget_collections: [],
  settlements: [],
  current_settlements: [],
  historical_settlements: []
};

const AppDataContext = createContext<AppState | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DatabasePayload>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (options?: { bypassCache?: boolean }) => {
    setIsLoading(true);
    try {
      const payload = await fetchAllDatabase(options);

      // Check client-side stored session if backend doesn't resolve Google identity
      let resolvedUser = payload.current_user ?? null;
      if (!resolvedUser && typeof localStorage !== 'undefined') {
        const storedUserId = localStorage.getItem('flatmate_active_user_id');
        const storedEmail = localStorage.getItem('flatmate_active_email');
        if (storedUserId && payload.members) {
          resolvedUser = payload.members.find((m) => m.user_id === storedUserId) ?? null;
        } else if (storedEmail && payload.members) {
          resolvedUser = payload.members.find((m) => (m.email || '').toLowerCase() === storedEmail.toLowerCase()) ?? null;
        }
      }

      setData({
        current_user: resolvedUser,
        current_cycle: payload.current_cycle ?? '',
        members: payload.members ?? [],
        groups: payload.groups ?? [],
        member_groups: payload.member_groups ?? [],
        inventory: payload.inventory ?? [],
        expenses: payload.expenses ?? [],
        current_expenses: payload.current_expenses ?? [],
        historical_expenses: payload.historical_expenses ?? [],
        stock_events: payload.stock_events ?? [],
        budget_requests: payload.budget_requests ?? [],
        budget_collections: payload.budget_collections ?? [],
        current_budget_collections: payload.current_budget_collections ?? [],
        historical_budget_collections: payload.historical_budget_collections ?? [],
        settlements: payload.settlements ?? [],
        current_settlements: payload.current_settlements ?? [],
        historical_settlements: payload.historical_settlements ?? []
      });
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch household data.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let syncInProgress = false;
    const syncQueuedMutations = async () => {
      if (syncInProgress || !navigator.onLine) return;
      syncInProgress = true;
      try {
        const result = await flushMutationQueue(
          (action, payload) => mutateDatabase(action, payload, { maxRetries: 1 }, { queueWhenOffline: false })
        );
        if (result.processed > 0) await loadData({ bypassCache: true });
      } finally {
        syncInProgress = false;
      }
    };

    window.addEventListener('online', syncQueuedMutations);
    if (navigator.onLine) void syncQueuedMutations();
    return () => window.removeEventListener('online', syncQueuedMutations);
  }, [loadData]);

  const updateStockStatusOptimistic = useCallback(
    async (itemId: string, newStatus: InventoryItem['current_status']) => {
      triggerHapticFeedback(25);
      const previousInventory = data.inventory;
      setData((prev) => ({
        ...prev,
        inventory: prev.inventory.map((item) =>
          item.item_id === itemId ? { ...item, current_status: newStatus } : item
        ),
      }));

      try {
        await updateStockStatus(itemId, newStatus);
      } catch (err) {
        setData((prev) => ({ ...prev, inventory: previousInventory }));
        triggerHapticFeedback([50, 100, 50]);
        throw err;
      }
    },
    [data.inventory]
  );

  const payBudgetCollectionOptimistic = useCallback(
    async (collectionId: string, paymentMethod: 'UPI' | 'CASH', screenshotBase64?: string) => {
      triggerHapticFeedback(25);
      const prevCollections = data.budget_collections ?? [];
      const prevCurrentCols = data.current_budget_collections ?? [];

      const markPaid = (col: BudgetCollection): BudgetCollection =>
        col.collection_id === collectionId
          ? {
              ...col,
              status: 'PAID',
              payment_method: paymentMethod,
              paid_at: new Date().toISOString()
            }
          : col;

      setData((prev) => ({
        ...prev,
        budget_collections: (prev.budget_collections ?? []).map(markPaid),
        current_budget_collections: (prev.current_budget_collections ?? []).map(markPaid)
      }));

      try {
        await payBudgetCollection({
          collection_id: collectionId,
          payment_method: paymentMethod,
          screenshot: screenshotBase64,
          is_cash: paymentMethod === 'CASH',
          paid_at: new Date().toISOString()
        });
      } catch (err) {
        setData((prev) => ({
          ...prev,
          budget_collections: prevCollections,
          current_budget_collections: prevCurrentCols
        }));
        triggerHapticFeedback([50, 100, 50]);
        throw err;
      }
    },
    [data.budget_collections, data.current_budget_collections]
  );

  const verifyBudgetCollectionOptimistic = useCallback(
    async (collectionId: string) => {
      triggerHapticFeedback(25);
      const prevCollections = data.budget_collections ?? [];
      const prevCurrentCols = data.current_budget_collections ?? [];
      const verifierId = data.current_user?.user_id ?? 'admin';

      const markVerified = (col: BudgetCollection): BudgetCollection =>
        col.collection_id === collectionId
          ? { ...col, status: 'VERIFIED', verified_by: verifierId }
          : col;

      setData((prev) => ({
        ...prev,
        budget_collections: (prev.budget_collections ?? []).map(markVerified),
        current_budget_collections: (prev.current_budget_collections ?? []).map(markVerified)
      }));

      try {
        await verifyBudgetCollection(collectionId, verifierId);
      } catch (err) {
        setData((prev) => ({
          ...prev,
          budget_collections: prevCollections,
          current_budget_collections: prevCurrentCols
        }));
        triggerHapticFeedback([50, 100, 50]);
        throw err;
      }
    },
    [data.budget_collections, data.current_budget_collections, data.current_user]
  );

  const loginAsUser = useCallback(
    async (member: Member) => {
      triggerHapticFeedback(30);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flatmate_active_user_id', member.user_id);
        localStorage.setItem('flatmate_active_email', member.email || '');
      }
      setData((prev) => ({ ...prev, current_user: member }));
      await loadData({ bypassCache: true });
    },
    [loadData]
  );

  const logout = useCallback(() => {
    triggerHapticFeedback(20);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('flatmate_active_user_id');
      localStorage.removeItem('flatmate_active_email');
    }
    setData((prev) => ({ ...prev, current_user: null }));
  }, []);

  return (
    <AppDataContext.Provider
      value={{
        current_user: data.current_user ?? null,
        current_cycle: data.current_cycle ?? '',
        members: data.members,
        groups: data.groups,
        member_groups: data.member_groups,
        inventory: data.inventory,
        expenses: data.expenses,
        current_expenses: data.current_expenses ?? [],
        historical_expenses: data.historical_expenses ?? [],
        stock_events: data.stock_events,
        budget_requests: data.budget_requests ?? [],
        budget_collections: data.budget_collections ?? [],
        current_budget_collections: data.current_budget_collections ?? [],
        historical_budget_collections: data.historical_budget_collections ?? [],
        settlements: data.settlements ?? [],
        current_settlements: data.current_settlements ?? [],
        historical_settlements: data.historical_settlements ?? [],
        isLoading,
        error,
        refreshData: loadData,
        updateStockStatusOptimistic,
        payBudgetCollectionOptimistic,
        verifyBudgetCollectionOptimistic,
        loginAsUser,
        logout
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) throw new Error("useAppData must be used within an AppDataProvider");
  return context;
};

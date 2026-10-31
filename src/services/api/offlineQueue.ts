import { get, set } from 'idb-keyval';
import type { DatabasePayload, ExpenseLog, InventoryItem, StockEvent } from '../../types/database';

export const OFFLINE_QUEUE_KEY = 'flatmate_os_mutation_outbox_v1';
const DATABASE_CACHE_KEY = 'flatmate_os_cache_fetch_all';

export interface QueuedMutation {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface QueueFlushResult {
  processed: number;
  failed: number;
}

export type MutationDispatcher = (action: string, payload: Record<string, unknown>) => Promise<unknown>;

let enqueueChain: Promise<void> = Promise.resolve();
let isFlushing = false;

export async function getQueuedMutationCount(): Promise<number> {
  const queue = await get<QueuedMutation[]>(OFFLINE_QUEUE_KEY);
  return queue?.length ?? 0;
}

export async function enqueueMutation(action: string, payload: Record<string, unknown>): Promise<void> {
  const write = enqueueChain.then(async () => {
    const queue = (await get<QueuedMutation[]>(OFFLINE_QUEUE_KEY)) ?? [];
    queue.push({
      id: createId(),
      action,
      payload,
      timestamp: Date.now(),
    });
    await set(OFFLINE_QUEUE_KEY, queue);
    await applyOptimisticSnapshot(action, payload);
  });
  enqueueChain = write.catch(() => undefined);
  return write;
}

export async function flushMutationQueue(
  dispatch: MutationDispatcher,
  onProgress?: (remaining: number) => void
): Promise<QueueFlushResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, failed: await getQueuedMutationCount() };
  }
  if (isFlushing) return { processed: 0, failed: await getQueuedMutationCount() };

  isFlushing = true;
  let processed = 0;
  let failed = 0;

  try {
    await enqueueChain;
    let queue = (await get<QueuedMutation[]>(OFFLINE_QUEUE_KEY)) ?? [];
    while (queue.length > 0) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;
      const [next, ...rest] = queue;
      try {
        await dispatch(next.action, next.payload);
        processed += 1;
        queue = rest;
        await set(OFFLINE_QUEUE_KEY, queue);
        onProgress?.(queue.length);
      } catch (error) {
        console.warn(`[offlineQueue] Retaining '${next.action}' for retry:`, error);
        failed = queue.length;
        onProgress?.(queue.length);
        break;
      }
    }
    failed = queue.length;
    return { processed, failed };
  } finally {
    isFlushing = false;
  }
}

async function applyOptimisticSnapshot(action: string, payload: Record<string, unknown>): Promise<void> {
  const snapshot = await get<DatabasePayload>(DATABASE_CACHE_KEY);
  if (!snapshot) return;

  const next = {
    ...snapshot,
    members: snapshot.members ?? [],
    groups: snapshot.groups ?? [],
    member_groups: snapshot.member_groups ?? [],
    inventory: snapshot.inventory ?? [],
    expenses: snapshot.expenses ?? [],
    current_expenses: snapshot.current_expenses ?? [],
    historical_expenses: snapshot.historical_expenses ?? [],
    stock_events: snapshot.stock_events ?? [],
    budget_requests: snapshot.budget_requests ?? [],
    budget_collections: snapshot.budget_collections ?? [],
    current_budget_collections: snapshot.current_budget_collections ?? [],
    historical_budget_collections: snapshot.historical_budget_collections ?? [],
    settlements: snapshot.settlements ?? [],
    current_settlements: snapshot.current_settlements ?? [],
    historical_settlements: snapshot.historical_settlements ?? [],
  };

  switch (action) {
    case 'update_stock': {
      next.inventory = next.inventory.map((item) => item.item_id === String(payload.item_id)
        ? { ...item, current_status: payload.new_status as InventoryItem['current_status'] }
        : item);
      break;
    }
    case 'add_item': {
      const item = payload as unknown as InventoryItem;
      if (!next.inventory.some((entry) => entry.item_id === item.item_id)) next.inventory = [...next.inventory, item];
      break;
    }
    case 'delete_item': {
      next.inventory = next.inventory.filter((item) => item.item_id !== String(payload.item_id));
      break;
    }
    case 'add_expense': {
      const entry = payload as unknown as ExpenseLog;
      if (!next.expenses.some((expense) => expense.expense_id === entry.expense_id)) {
        const amount = Number(entry.amount);
        const groupStrength = new Set(next.member_groups
          .filter((mapping) => mapping.group_id === entry.group_id)
          .map((mapping) => mapping.user_id)).size || 1;
        const netAmount = Number((amount - amount / groupStrength).toFixed(2));
        const optimisticExpense = { ...entry, amount: netAmount };
        next.expenses = [...next.expenses, optimisticExpense];
        next.current_expenses = [...next.current_expenses, optimisticExpense];
      }
      break;
    }
    case 'delete_expense': {
      next.expenses = next.expenses.filter((expense) => expense.expense_id !== String(payload.expense_id));
      next.current_expenses = next.current_expenses.filter((expense) => expense.expense_id !== String(payload.expense_id));
      next.historical_expenses = next.historical_expenses.filter((expense) => expense.expense_id !== String(payload.expense_id));
      break;
    }
    case 'join_group': {
      const currentUserId = next.current_user?.user_id;
      const requestedIds = Array.isArray(payload.group_ids) ? payload.group_ids.map(String) : [];
      if (currentUserId) {
        for (const groupId of requestedIds) {
          if (!next.member_groups.some((mapping) => mapping.user_id === currentUserId && mapping.group_id === groupId)) {
            next.member_groups = [...next.member_groups, { map_id: createId(), group_id: groupId, user_id: currentUserId }];
          }
        }
      }
      break;
    }
    case 'request_budget': {
      const requestId = String(payload.request_id ?? createId());
      if (!next.budget_requests.some((request) => request.request_id === requestId)) {
        next.budget_requests = [...next.budget_requests, {
          request_id: requestId,
          group_id: String(payload.group_id ?? ''),
          requested_by: String(payload.requested_by ?? next.current_user?.user_id ?? ''),
          amount: Number(payload.amount ?? 0),
          is_cash: Boolean(payload.is_cash),
          status: 'PENDING',
        }];
      }
      break;
    }
    case 'approve_budget': {
      next.budget_requests = next.budget_requests.map((request) => request.request_id === String(payload.request_id)
        ? { ...request, status: 'APPROVED' }
        : request);
      break;
    }
    case 'pay_budget_collection': {
      const colId = String(payload.collection_id ?? '');
      const markPaid = (col: any) => col.collection_id === colId
        ? { ...col, status: 'PAID', payment_method: payload.payment_method ?? (payload.is_cash ? 'CASH' : 'UPI'), paid_at: new Date().toISOString() }
        : col;
      next.budget_collections = next.budget_collections.map(markPaid);
      next.current_budget_collections = next.current_budget_collections.map(markPaid);
      break;
    }
    case 'verify_budget_collection': {
      const colId = String(payload.collection_id ?? '');
      const markVerified = (col: any) => col.collection_id === colId
        ? { ...col, status: 'VERIFIED', verified_by: String(payload.verified_by ?? next.current_user?.user_id ?? 'admin') }
        : col;
      next.budget_collections = next.budget_collections.map(markVerified);
      next.current_budget_collections = next.current_budget_collections.map(markVerified);
      break;
    }
    case 'settle_debt': {
      const settlementId = String(payload.settlement_id ?? createId());
      if (!next.settlements.some((settlement) => settlement.settlement_id === settlementId)) {
        const entry = {
          settlement_id: settlementId,
          payer_id: String(payload.payer_id ?? next.current_user?.user_id ?? ''),
          payee_id: String(payload.payee_id ?? ''),
          amount: Number(payload.amount ?? 0),
          timestamp: String(payload.timestamp ?? new Date().toISOString()),
          month_cycle: String(payload.month_cycle ?? next.current_cycle ?? ''),
        };
        next.settlements = [...next.settlements, entry];
        next.current_settlements = [...next.current_settlements, entry];
      }
      break;
    }
    case 'record_stock_event': {
      const event = payload as unknown as StockEvent;
      if (!next.stock_events.some((stored) => stored.event_id === event.event_id)) next.stock_events = [...next.stock_events, event];
      break;
    }
  }

  await set(DATABASE_CACHE_KEY, next);
}

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

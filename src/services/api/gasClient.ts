/**
 * ==============================================================================
 * FlatMate OS - Google Apps Script Transport & Resilience Client
 * File: src/services/api/gasClient.ts
 * ==============================================================================
 * Architectural Directives:
 * 1. Cache-first / SWR pattern with IndexedDB via `idb-keyval`.
 * 2. Exponential backoff retry policy for mutations (up to 3 retries).
 * 3. Text/plain request headers to avoid Apps Script CORS preflight (OPTIONS) rejection.
 * 4. Zero-Trust Identity: mutations rely on server-side Session context.
 */

import { get, set } from 'idb-keyval';
import { enqueueMutation } from './offlineQueue';
import type {
  ApiResponse,
  DatabasePayload,
  Member,
  StockUpdatePayload,
  InventoryItemCreatePayload,
  InventoryItemDeletePayload,
  ExpenseCreatePayload,
  ExpenseDeletePayload,
  BudgetRequestCreatePayload,
  BudgetApprovePayload,
  PayBudgetCollectionPayload,
  VerifyBudgetCollectionPayload,
  SettleDebtPayload,
  StockEventCreatePayload,
  StockStatus
} from '../../types/database';
import type { RetryConfig } from '../../types/api';

const API_URL = (import.meta.env.VITE_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbzixDu1AU_qs0vG3APylExqlcawx7OrrL08BjnVTnACLyljvZ4C1tTa4DSCQe2AeJ_o/exec') as string;
const CACHE_PREFIX = 'flatmate_os_cache';

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 600,
  backoffMultiplier: 2
};

/**
 * Utility helper to sleep asynchronously.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==============================================================================
// 1. QUERY / READ CLIENT (Cache-First with SWR Revalidation)
// ==============================================================================

/**
 * Fetches database records with an offline-first cache strategy.
 */
export async function fetchDatabase<T = unknown>(
  action: string,
  options: { bypassCache?: boolean } = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error('VITE_GAS_API_URL environment variable is not defined.');
  }

  const cacheKey = `${CACHE_PREFIX}_${action}`;
  const cachedData = options.bypassCache ? undefined : await get<T>(cacheKey);

  // Background revalidation routine
  const networkPromise = (async (): Promise<T> => {
    try {
      const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('flatmate_active_user_id') : null;
      const activeEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('flatmate_active_email') : null;
      let url = `${API_URL}?action=${encodeURIComponent(action)}`;
      if (activeUserId) url += `&user_id=${encodeURIComponent(activeUserId)}`;
      if (activeEmail) url += `&email=${encodeURIComponent(activeEmail)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as ApiResponse<T>;

      if (result.status === 'success' && result.payload !== undefined) {
        await set(cacheKey, result.payload);
        return result.payload;
      }

      throw new Error(result.message || 'Unknown server response error.');
    } catch (networkError) {
      console.warn(`[gasClient] Network read failed for action '${action}':`, networkError);
      throw networkError;
    }
  })();

  if (cachedData !== undefined) {
    networkPromise.catch((err) => {
      console.info(`[gasClient] Background SWR revalidation failed for '${action}': ${err.message}`);
    });
    return cachedData;
  }

  try {
    return await networkPromise;
  } catch (error) {
    const fallbackCache = await get<T>(cacheKey);
    if (fallbackCache !== undefined) {
      return fallbackCache;
    }
    throw new Error('You are currently offline and no cached data is available for this view.');
  }
}

/**
 * Convenience helper to fetch all 8 relational datasets (partitioned) in a single synchronized call.
 */
export async function fetchAllDatabase(options?: { bypassCache?: boolean }): Promise<DatabasePayload> {
  return fetchDatabase<DatabasePayload>('fetch_all', options);
}

/**
 * Retrieves the currently authenticated user profile from the backend.
 */
export async function getMe(): Promise<Member | null> {
  try {
    const response = await fetch(`${API_URL}?action=get_me`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const result = (await response.json()) as ApiResponse<Member>;
    if (result.status === 'success' && result.payload) {
      return result.payload;
    }
    return null;
  } catch (err) {
    console.warn('[gasClient] Failed to fetch current user profile:', err);
    return null;
  }
}

// ==============================================================================
// 2. MUTATION CLIENT (With Exponential Backoff Retry)
// ==============================================================================

/**
 * Pushes mutations to Google Apps Script.
 * Uses `Content-Type: text/plain;charset=utf-8` to bypass CORS preflight checks.
 */
export async function mutateDatabase<TResponse = unknown, TPayload = unknown>(
  action: string,
  payload: TPayload,
  config: RetryConfig = {},
  options: { queueWhenOffline?: boolean } = {}
): Promise<ApiResponse<TResponse>> {
  if (!API_URL) {
    throw new Error('VITE_GAS_API_URL environment variable is not defined.');
  }

  const { maxRetries, initialDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  };

  const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('flatmate_active_user_id') : null;
  const activeEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('flatmate_active_email') : null;

  const envelope = {
    action,
    payload,
    client_user_id: activeUserId,
    client_email: activeEmail
  };
  const queueWhenOffline = options.queueWhenOffline ?? true;

  if (queueWhenOffline && typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueMutation(action, asRecord(payload));
    return {
      status: 'success',
      action,
      message: 'Saved offline and queued to sync when connection returns.',
    };
  }

  let currentDelay = initialDelayMs;
  let lastError: Error = new Error('Unknown mutation failure');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(envelope)
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as ApiResponse<TResponse>;

      if (result.status === 'success') {
        return result;
      }

      throw new Error(result.message || 'Mutation failed at Google Apps Script backend.');

    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[gasClient] Mutation attempt ${attempt}/${maxRetries} for '${action}' failed: ${lastError.message}`);

      if (queueWhenOffline && typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueueMutation(action, asRecord(payload));
        return {
          status: 'success',
          action,
          message: 'Connection lost. Saved offline and queued to sync when it returns.',
        };
      }

      if (attempt < maxRetries) {
        const jitter = Math.random() * 150;
        await wait(currentDelay + jitter);
        currentDelay *= backoffMultiplier;
      }
    }
  }

  throw new Error(`Failed to save after ${maxRetries} attempts: ${lastError.message}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

// ==============================================================================
// 3. SPECIALIZED MUTATION HELPERS
// ==============================================================================

/**
 * Enrolls the authenticated user into specified subgroups.
 */
export async function joinGroups(groupIds: string[]): Promise<ApiResponse> {
  return mutateDatabase('join_group', { group_ids: groupIds });
}

/**
 * Updates inventory stock status and logs a stock transition event.
 */
export async function updateStockStatus(
  itemId: string,
  newStatus: StockStatus,
  reportedBy: string = 'FLATMATE'
): Promise<ApiResponse> {
  const payload: StockUpdatePayload = {
    item_id: itemId,
    new_status: newStatus,
    reported_by: reportedBy
  };
  return mutateDatabase('update_stock', payload);
}

/**
 * Appends a newly created inventory item to dim_inventory.
 */
export async function addInventoryItem(item: InventoryItemCreatePayload): Promise<ApiResponse> {
  return mutateDatabase('add_item', item);
}

/**
 * Locates an item in dim_inventory by item_id and deletes its row.
 */
export async function deleteInventoryItem(itemId: string): Promise<ApiResponse> {
  const payload: InventoryItemDeletePayload = { item_id: itemId };
  return mutateDatabase('delete_item', payload);
}

/**
 * Adds an expense record with fair-share debt deduction.
 */
export async function addExpense(expense: ExpenseCreatePayload): Promise<ApiResponse> {
  const payload: ExpenseCreatePayload = {
    expense_id: expense.expense_id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `EXP_${Date.now()}`),
    timestamp: expense.timestamp ?? new Date().toISOString(),
    item_id: expense.item_id,
    group_id: expense.group_id,
    amount: expense.amount
  };
  return mutateDatabase('add_expense', payload);
}

/**
 * Locates an expense row in fact_expense_logs by expense_id and deletes it.
 */
export async function deleteExpense(expenseId: string): Promise<ApiResponse> {
  const payload: ExpenseDeletePayload = { expense_id: expenseId };
  return mutateDatabase('delete_expense', payload);
}

/**
 * Submits a budget request with an optional Base64 screenshot proof uploaded to Google Drive.
 */
export async function requestBudget(request: BudgetRequestCreatePayload): Promise<ApiResponse> {
  return mutateDatabase('request_budget', request);
}

/**
 * Approves a budget request and increases the corresponding group's budget target.
 */
export async function approveBudget(requestId: string): Promise<ApiResponse> {
  const payload: BudgetApprovePayload = { request_id: requestId };
  return mutateDatabase('approve_budget', payload);
}

/**
 * Pays monthly fixed budget collection dues (with optional UPI screenshot proof).
 */
export async function payBudgetCollection(payload: PayBudgetCollectionPayload): Promise<ApiResponse> {
  return mutateDatabase('pay_budget_collection', payload);
}

/**
 * Verifies a roommate's monthly budget dues payment.
 */
export async function verifyBudgetCollection(collectionId: string, verifiedBy?: string): Promise<ApiResponse> {
  const payload: VerifyBudgetCollectionPayload = { collection_id: collectionId, verified_by: verifiedBy };
  return mutateDatabase('verify_budget_collection', payload);
}

/**
 * Logs a cleared debt when a user pays via UPI.
 */
export async function settleDebt(settlement: SettleDebtPayload): Promise<ApiResponse> {
  return mutateDatabase('settle_debt', settlement);
}

/**
 * Records a pantry audit or restocking event in fact_stock_events.
 */
export async function recordStockEvent(event: StockEventCreatePayload): Promise<ApiResponse> {
  return mutateDatabase('record_stock_event', event);
}

/**
 * ==============================================================================
 * FlatMate OS - API Transport & Protocol Types
 * ==============================================================================
 */

export type {
  ApiResponse,
  DatabasePayload,
  Member,
  Group,
  MemberGroupMapping,
  InventoryItem,
  ExpenseLog,
  StockEvent,
  BudgetRequest,
  BudgetCollection,
  SettlementLog,
  JoinGroupPayload,
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
  StockStatus,
  StockEventType,
  BudgetRequestStatus
} from './database';

export interface GasRequestEnvelope<T = unknown> {
  action: string;
  payload?: T;
}

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * ==============================================================================
 * FlatMate OS - Database Relational Schema Contracts
 * ==============================================================================
 * Strongly typed interface contracts directly reflecting the 8 Google Sheet tabs:
 * 1. dim_members
 * 2. dim_groups
 * 3. map_member_group
 * 4. dim_inventory
 * 5. fact_expense_logs
 * 6. fact_stock_events
 * 7. fact_budget_requests
 * 8. fact_settlements
 */

// ------------------------------------------------------------------------------
// 1. DIMENSION TABLES
// ------------------------------------------------------------------------------

/**
 * dim_members: Master table of household flatmates.
 */
export interface Member {
  /** Unique primary identifier (e.g. USR_01) */
  user_id: string;
  /** Full or preferred display name */
  name: string;
  /** Google Account email for server-side Zero-Trust identity */
  email?: string;
  /** Primary UPI VPA address for instant peer settlements */
  upi_id: string;
  /** Active membership status flag */
  is_active: boolean;
}

/**
 * dim_groups: Expense pools and communal sub-clusters.
 */
export interface Group {
  /** Group identifier (e.g. GRP_ALL, GRP_VEG, GRP_NONVEG, GRP_TEA) */
  group_id: string;
  /** User-friendly name of the expense group */
  group_name: string;
  /** Recommended monthly collective spending target in INR */
  budget_target: number;
}

/**
 * map_member_group: N:M relational mapping between members and groups.
 */
export interface MemberGroupMapping {
  /** Unique row mapping ID (e.g. MAP_1) */
  map_id: string;
  /** Foreign key pointing to dim_groups.group_id */
  group_id: string;
  /** Foreign key pointing to dim_members.user_id */
  user_id: string;
}

// ------------------------------------------------------------------------------
// 2. INVENTORY & STATUS DOMAIN
// ------------------------------------------------------------------------------

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

/**
 * dim_inventory: Pantry and household consumable catalog.
 */
export interface InventoryItem {
  /** Unique item identifier (e.g. ITM_01) */
  item_id: string;
  /** Human-readable item name */
  item_name: string;
  /** Default group responsible for splitting costs (Foreign Key to dim_groups) */
  group_id: string;
  /** Essential flag: true triggers high-priority buy list scoring */
  is_essential: boolean;
  /** Current pantry stock state */
  current_status: StockStatus;
}

// ------------------------------------------------------------------------------
// 3. FACT & TRANSACTION LEDGER TABLES
// ------------------------------------------------------------------------------

/**
 * fact_expense_logs: Immutable ledger recording all communal expenditures.
 */
export interface ExpenseLog {
  /** Unique expense UUID */
  expense_id: string;
  /** ISO-8601 creation timestamp */
  timestamp: string;
  /** Associated inventory item ID or human description of the purchase */
  item_id: string;
  /** Associated expense split pool group ID */
  group_id: string;
  /** Foreign key referencing dim_members.user_id who made the payment */
  paid_by: string;
  /** Net debt obligation amount in INR (excluding payer's own fair share) */
  amount: number;
}

export type StockEventType = StockStatus | 'RESTOCKED' | 'AUDIT';

/**
 * fact_stock_events: Audit log tracking every pantry stock status transition.
 */
export interface StockEvent {
  /** Unique event identifier (e.g. EVT_12345678) */
  event_id: string;
  /** ISO-8601 transition timestamp */
  timestamp: string;
  /** Item identifier referenced in dim_inventory */
  item_id: string;
  /** Stock event type or target status */
  event_type: StockEventType;
  /** Member ID or system tag that triggered the transition */
  reported_by: string;
}

export type BudgetRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * fact_budget_requests: Requests to raise budget targets with payment proof.
 */
export interface BudgetRequest {
  request_id: string;
  group_id: string;
  requested_by: string;
  amount: number;
  screenshot_url?: string;
  is_cash: boolean;
  status: BudgetRequestStatus;
}

/**
 * fact_settlements: Audit records of executed debt payments.
 */
export interface SettlementLog {
  settlement_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  timestamp: string;
  month_cycle: string;
}

/**
 * Monthly fixed budget collection quota per roommate.
 */
export interface BudgetCollection {
  collection_id: string;
  month_cycle: string;
  group_id: string;
  user_id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'VERIFIED';
  payment_method?: 'UPI' | 'CASH' | string;
  screenshot_url?: string;
  paid_at?: string;
  verified_by?: string;
}

// ------------------------------------------------------------------------------
// 4. AGGREGATE DATABASE ENVELOPE
// ------------------------------------------------------------------------------

/**
 * Complete synchronized snapshot returned by the 'fetch_all' endpoint.
 */
export interface DatabasePayload {
  /** Authenticated user profile resolved server-side */
  current_user?: Member | null;
  /** Current billing cycle string in YYYY-MM format */
  current_cycle?: string;
  members: Member[];
  groups: Group[];
  member_groups: MemberGroupMapping[];
  inventory: InventoryItem[];
  expenses: ExpenseLog[];
  current_expenses?: ExpenseLog[];
  historical_expenses?: ExpenseLog[];
  stock_events: StockEvent[];
  budget_requests?: BudgetRequest[];
  budget_collections?: BudgetCollection[];
  current_budget_collections?: BudgetCollection[];
  historical_budget_collections?: BudgetCollection[];
  settlements?: SettlementLog[];
  current_settlements?: SettlementLog[];
  historical_settlements?: SettlementLog[];
}

// ------------------------------------------------------------------------------
// 5. CLIENT MUTATION PAYLOAD CONTRACTS
// ------------------------------------------------------------------------------

export interface PayBudgetCollectionPayload {
  collection_id: string;
  payment_method?: 'UPI' | 'CASH';
  screenshot?: string;
  is_cash?: boolean;
  paid_at?: string;
}

export interface VerifyBudgetCollectionPayload {
  collection_id: string;
  verified_by?: string;
}

export interface JoinGroupPayload {
  group_ids: string[];
}

export interface StockUpdatePayload {
  item_id: string;
  new_status: StockStatus;
  reported_by?: string;
}

export interface InventoryItemCreatePayload {
  item_id: string;
  item_name: string;
  group_id: string;
  is_essential: boolean;
  current_status?: StockStatus;
  reported_by?: string;
}

export interface InventoryItemDeletePayload {
  item_id: string;
}

export interface ExpenseCreatePayload {
  expense_id?: string;
  item_id: string;
  group_id: string;
  amount: number;
  paid_by?: string;
  timestamp?: string;
}

export interface ExpenseDeletePayload {
  expense_id: string;
}

export interface BudgetRequestCreatePayload {
  request_id?: string;
  group_id: string;
  amount: number;
  screenshot?: string; // Base64 data URL
  screenshot_url?: string;
  is_cash?: boolean;
  reason?: string;
}

export interface BudgetApprovePayload {
  request_id: string;
}

export interface SettleDebtPayload {
  payee_id: string;
  amount: number;
  month_cycle?: string;
  timestamp?: string;
}

export interface StockEventCreatePayload {
  event_id?: string;
  item_id: string;
  event_type: StockEventType;
  reported_by: string;
  timestamp?: string;
}

/**
 * Generic API Response wrapper from Google Apps Script.
 */
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  action?: string;
  message?: string;
  payload?: T;
  timestamp?: string;
  eventId?: string;
  expense_id?: string;
  item_id?: string;
  request_id?: string;
  settlement_id?: string;
}

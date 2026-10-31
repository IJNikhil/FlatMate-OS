/**
 * ==============================================================================
 * FlatMate OS - Pure Deterministic Greedy Debt Minimization Engine
 * File: src/features/settlements/utils/debtSimplifier.ts
 * ==============================================================================
 * Algorithmic Complexity: O(N log N) where N is the number of participants.
 * Computes the minimum number of peer-to-peer settlement transactions required
 * to resolve all communal credit/debit balances to zero.
 */

import type { ExpenseLog, Member, MemberGroupMapping } from '../../../types/database';

export interface SettlementTransaction {
  /** user_id of the flatmate who owes money (Debtor) */
  from: string;
  /** user_id of the flatmate who is owed money (Creditor) */
  to: string;
  /** Rounded settlement amount in INR (>= 0.01) */
  amount: number;
}

/** Epsilon threshold to ignore negligible floating point dust (e.g. ₹0.009) */
const EPSILON = 0.01;

/**
 * Rounds a number to exactly two decimal places.
 */
function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Executes the Greedy Cash-Flow algorithm to simplify communal debts.
 *
 * @param balances Record mapping member user_id to their net balance (Paid - Consumed).
 *                 Positive balance = Creditor (is owed money).
 *                 Negative balance = Debtor (owes money).
 * @returns Array of optimized discrete settlement transactions.
 */
export function simplifyDebts(balances: Record<string, number>): SettlementTransaction[] {
  if (!balances || typeof balances !== 'object') {
    return [];
  }

  // 1. Separate participants into Debtors and Creditors
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  for (const [id, rawBalance] of Object.entries(balances)) {
    if (typeof rawBalance !== 'number' || !Number.isFinite(rawBalance)) {
      continue;
    }

    const rounded = roundCurrency(rawBalance);

    if (rounded < -EPSILON) {
      debtors.push({ id, amount: Math.abs(rounded) });
    } else if (rounded > EPSILON) {
      creditors.push({ id, amount: rounded });
    }
  }

  // If no one owes or is owed, all balances are settled
  if (debtors.length === 0 || creditors.length === 0) {
    return [];
  }

  // 2. Sort both lists in descending order: largest amounts settled first
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: SettlementTransaction[] = [];
  let debtorIdx = 0;
  let creditorIdx = 0;

  // 3. Greedy two-pointer pairing
  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    // Determine the maximum transferable amount between this pair
    const rawSettled = Math.min(debtor.amount, creditor.amount);
    const amountToPay = roundCurrency(rawSettled);

    if (amountToPay >= EPSILON && debtor.id !== creditor.id) {
      transactions.push({
        from: debtor.id,
        to: creditor.id,
        amount: amountToPay
      });
    }

    // Deduct settled amount
    debtor.amount = roundCurrency(debtor.amount - amountToPay);
    creditor.amount = roundCurrency(creditor.amount - amountToPay);

    // Advance pointers when balance is exhausted below epsilon
    if (debtor.amount < EPSILON) {
      debtorIdx++;
    }
    if (creditor.amount < EPSILON) {
      creditorIdx++;
    }
  }

  return transactions;
}

/**
 * Calculates net peer balances across all active flatmates adhering to:
 * - Global items (e.g. GRP_ALL): Split equally across all active house members (N_all).
 * - Subgroup items (e.g. GRP_VEG, GRP_NONVEG, GRP_TEA): Split strictly across active members
 *   mapped in `map_member_group` (N_sub).
 *
 * @param expenses Array of logged communal expenses.
 * @param members Master array of house members.
 * @param memberGroups Relational mapping of members to subgroups.
 * @param globalGroupId Identifier for the house-wide global group (default: 'GRP_ALL').
 * @returns Record of net balances per member user_id.
 */
export function calculateGroupBalances(
  expenses: ExpenseLog[],
  members: Member[],
  memberGroups: MemberGroupMapping[] = [],
  globalGroupId: string = 'GRP_ALL'
): Record<string, number> {
  const activeMembers = members.filter((m) => m.is_active);
  const activeMemberIds = new Set(activeMembers.map((m) => m.user_id));

  const balances: Record<string, number> = {};
  for (const m of activeMembers) {
    balances[m.user_id] = 0;
  }

  if (activeMembers.length === 0 || !expenses || expenses.length === 0) {
    return balances;
  }

  // Pre-index members by group
  const groupMembersMap: Record<string, string[]> = {};
  for (const mapping of memberGroups) {
    if (activeMemberIds.has(mapping.user_id)) {
      if (!groupMembersMap[mapping.group_id]) {
        groupMembersMap[mapping.group_id] = [];
      }
      groupMembersMap[mapping.group_id].push(mapping.user_id);
    }
  }

  for (const exp of expenses) {
    const amount = Number(exp.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const payer = exp.paid_by;
    // Credit payer if active member
    if (balances[payer] !== undefined) {
      balances[payer] = roundCurrency(balances[payer] + amount);
    }

    // Determine target consumers for this split group
    let consumers: string[] = [];
    if (exp.group_id === globalGroupId || !groupMembersMap[exp.group_id]) {
      // Global household: split across all active members
      consumers = activeMembers.map((m) => m.user_id);
    } else {
      // Subgroup: split strictly across mapped active members
      consumers = groupMembersMap[exp.group_id];
      if (consumers.length === 0) {
        consumers = activeMembers.map((m) => m.user_id);
      }
    }

    const splitAmount = amount / consumers.length;
    for (const consumerId of consumers) {
      if (balances[consumerId] !== undefined) {
        balances[consumerId] = roundCurrency(balances[consumerId] - splitAmount);
      }
    }
  }

  return balances;
}

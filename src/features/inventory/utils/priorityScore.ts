import type { InventoryItem } from '../../../types/database';

const STATUS_WEIGHTS = {
  OUT_OF_STOCK: 1,
  LOW_STOCK: 2,
  IN_STOCK: 10,
};

/**
 * Calculates priority score (Lower score = Higher priority)
 * Essential items get a +0 weight (keeps them low/high priority).
 * Non-essential items get a +5 penalty (pushes them down).
 */
export function calculatePriority(item: InventoryItem): number {
  const statusWeight = STATUS_WEIGHTS[item.current_status];
  const essentialWeight = item.is_essential ? 0 : 5;
  
  return statusWeight + essentialWeight;
}

/**
 * Sorts inventory items for the Smart Buy List.
 * Empty essentials appear first, stocked non-essentials appear last.
 */
export function sortInventoryForBuyList(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    const scoreA = calculatePriority(a);
    const scoreB = calculatePriority(b);
    
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    
    // Alphabetical tie-breaker if priority scores match
    return a.item_name.localeCompare(b.item_name);
  });
}
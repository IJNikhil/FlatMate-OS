import type { MemberGroupMapping } from '../../../types/database';

export function getMemberGroupIds(
  userId: string | undefined,
  mappings: MemberGroupMapping[]
): Set<string> {
  if (!userId) return new Set();
  return new Set(
    mappings
      .filter((mapping) => mapping.user_id === userId)
      .map((mapping) => mapping.group_id)
  );
}

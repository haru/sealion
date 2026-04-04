import type { SortCriterion } from "@/lib/types";

interface SortableIssue {
  id: string;
  pinned: boolean;
  dueDate: string | null;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
}

/**
 * Utility that asserts a value is `never` at compile time.
 * Used as an exhaustiveness guard in switch statements so that
 * TypeScript produces an error when a union member is not handled.
 * @param _value - A value that should be `never` if all cases are covered.
 */
function assertNever(_value: never): never {
  throw new Error(`Unhandled discriminated union member: ${String(_value)}`);
}

/**
 * Compares two nullable date strings in ascending order.
 * Null values are always sorted to the end (nulls last).
 * @param a - First date string or null.
 * @param b - Second date string or null.
 * @returns Negative if `a < b`, positive if `a > b`, zero if equal. Nulls sort to the end.
 */
function compareDateAsc(a: string | null, b: string | null): number {
  if (a === null && b === null) { return 0; }
  if (a === null) { return 1; }
  if (b === null) { return -1; }
  // Lexicographic comparison is valid because all date strings are ISO 8601 format.
  if (a < b) { return -1; }
  if (a > b) { return 1; }
  return 0;
}

/**
 * Compares two nullable date strings in descending order.
 * Null values are always sorted to the end (nulls last).
 * @param a - First date string or null.
 * @param b - Second date string or null.
 * @returns Positive if `a < b`, negative if `a > b`, zero if equal. Nulls sort to the end.
 */
function compareDateDesc(a: string | null, b: string | null): number {
  if (a === null && b === null) { return 0; }
  if (a === null) { return 1; }
  if (b === null) { return -1; }
  // Lexicographic comparison is valid because all date strings are ISO 8601 format.
  if (a < b) { return 1; }
  if (a > b) { return -1; }
  return 0;
}

/**
 * Sorts an array of issues client-side, mirroring the server-side sort logic
 * in the GET /api/issues endpoint: pinned first (desc), then user-defined
 * sort criteria, then id as a deterministic tiebreaker.
 * @param issues - The array of issues to sort.
 * @param criteria - User-defined sort criteria in priority order.
 * @returns A new array sorted according to the pinned-first + criteria + id rules.
 */
export function sortIssues<T extends SortableIssue>(issues: T[], criteria: SortCriterion[]): T[] {
  return [...issues].sort((a, b) => {
    if (a.pinned !== b.pinned) { return a.pinned ? -1 : 1; }

    for (const criterion of criteria) {
      let cmp = 0;
      switch (criterion) {
        case "dueDate_asc":
          cmp = compareDateAsc(a.dueDate, b.dueDate);
          break;
        case "providerUpdatedAt_desc":
          cmp = compareDateDesc(a.providerUpdatedAt, b.providerUpdatedAt);
          break;
        case "providerCreatedAt_desc":
          cmp = compareDateDesc(a.providerCreatedAt, b.providerCreatedAt);
          break;
        default:
          return assertNever(criterion);
      }
      if (cmp !== 0) { return cmp; }
    }

    if (a.id < b.id) { return -1; }
    if (a.id > b.id) { return 1; }
    return 0;
  });
}

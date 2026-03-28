import { sortIssues } from "@/lib/sort-utils";
import type { SortCriterion } from "@/lib/types";

interface TestIssue {
  id: string;
  pinned: boolean;
  dueDate: string | null;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
}

const DEFAULT_CRITERIA: SortCriterion[] = ["dueDate_asc", "providerUpdatedAt_desc"];

function makeIssue(overrides: Partial<TestIssue> & { id: string }): TestIssue {
  return {
    pinned: false,
    dueDate: null,
    providerCreatedAt: null,
    providerUpdatedAt: null,
    ...overrides,
  };
}

describe("sortIssues", () => {
  it("sorts pinned issues before unpinned", () => {
    const issues = [
      makeIssue({ id: "1", pinned: false }),
      makeIssue({ id: "2", pinned: true }),
      makeIssue({ id: "3", pinned: false }),
    ];
    const result = sortIssues(issues, DEFAULT_CRITERIA);
    expect(result.map((i) => i.id)).toEqual(["2", "1", "3"]);
  });

  it("uses id as tiebreaker within the same pinned group", () => {
    const issues = [
      makeIssue({ id: "3", pinned: false }),
      makeIssue({ id: "1", pinned: false }),
      makeIssue({ id: "2", pinned: false }),
    ];
    const result = sortIssues(issues, []);
    expect(result.map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts by dueDate_asc with nulls last", () => {
    const issues = [
      makeIssue({ id: "1", dueDate: "2026-03-20T00:00:00Z" }),
      makeIssue({ id: "2", dueDate: null }),
      makeIssue({ id: "3", dueDate: "2026-03-10T00:00:00Z" }),
    ];
    const result = sortIssues(issues, ["dueDate_asc"]);
    expect(result.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by providerUpdatedAt_desc with nulls last", () => {
    const issues = [
      makeIssue({ id: "1", providerUpdatedAt: "2026-03-10T00:00:00Z" }),
      makeIssue({ id: "2", providerUpdatedAt: null }),
      makeIssue({ id: "3", providerUpdatedAt: "2026-03-20T00:00:00Z" }),
    ];
    const result = sortIssues(issues, ["providerUpdatedAt_desc"]);
    expect(result.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by providerCreatedAt_desc with nulls last", () => {
    const issues = [
      makeIssue({ id: "1", providerCreatedAt: "2026-03-10T00:00:00Z" }),
      makeIssue({ id: "2", providerCreatedAt: null }),
      makeIssue({ id: "3", providerCreatedAt: "2026-03-20T00:00:00Z" }),
    ];
    const result = sortIssues(issues, ["providerCreatedAt_desc"]);
    expect(result.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("applies multiple criteria in order", () => {
    const issues = [
      makeIssue({ id: "1", dueDate: "2026-03-15T00:00:00Z", providerUpdatedAt: "2026-03-20T00:00:00Z" }),
      makeIssue({ id: "2", dueDate: "2026-03-15T00:00:00Z", providerUpdatedAt: "2026-03-10T00:00:00Z" }),
      makeIssue({ id: "3", dueDate: "2026-03-10T00:00:00Z", providerUpdatedAt: null }),
    ];
    const result = sortIssues(issues, ["dueDate_asc", "providerUpdatedAt_desc"]);
    expect(result.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("pins first, then applies criteria, then id tiebreaker", () => {
    const issues = [
      makeIssue({ id: "1", pinned: false, dueDate: "2026-03-10T00:00:00Z" }),
      makeIssue({ id: "2", pinned: true, dueDate: "2026-03-20T00:00:00Z" }),
      makeIssue({ id: "3", pinned: true, dueDate: "2026-03-15T00:00:00Z" }),
      makeIssue({ id: "4", pinned: false, dueDate: null }),
    ];
    const result = sortIssues(issues, ["dueDate_asc"]);
    expect(result.map((i) => i.id)).toEqual(["3", "2", "1", "4"]);
  });

  it("returns empty array for empty input", () => {
    expect(sortIssues([], DEFAULT_CRITERIA)).toEqual([]);
  });

  it("returns single-item array unchanged", () => {
    const issues = [makeIssue({ id: "1" })];
    expect(sortIssues(issues, DEFAULT_CRITERIA)).toEqual(issues);
  });
});

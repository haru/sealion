/**
 * Unit tests for parseSearchQuery.
 * Tests cover: empty input, single keyword, multi-keyword OR split,
 * double-quoted phrase, unclosed quote, prefix tokens, and combinations.
 */

import { parseSearchQuery } from "@/lib/search-parser";

describe("parseSearchQuery", () => {
  describe("empty / whitespace input", () => {
    it("returns empty keywords for empty string", () => {
      expect(parseSearchQuery("")).toEqual({ keywords: [] });
    });

    it("returns empty keywords for whitespace-only string", () => {
      expect(parseSearchQuery("   ")).toEqual({ keywords: [] });
    });
  });

  describe("keyword parsing", () => {
    it("returns a single keyword for a single word", () => {
      expect(parseSearchQuery("bug")).toEqual({ keywords: ["bug"] });
    });

    it("splits multiple words into separate OR keywords", () => {
      expect(parseSearchQuery("fix login")).toEqual({ keywords: ["fix", "login"] });
    });

    it("handles extra whitespace between words", () => {
      expect(parseSearchQuery("  fix  login  ")).toEqual({ keywords: ["fix", "login"] });
    });

    it("treats double-quoted string as a single phrase keyword", () => {
      expect(parseSearchQuery('"fix login"')).toEqual({ keywords: ["fix login"] });
    });

    it("treats unclosed double-quote content as plain keywords", () => {
      // unclosed quote → split normally
      expect(parseSearchQuery('"fix login')).toEqual({ keywords: ["fix", "login"] });
    });

    it("handles mix of quoted and unquoted tokens", () => {
      expect(parseSearchQuery('"fix login" bug')).toEqual({
        keywords: ["fix login", "bug"],
      });
    });
  });

  describe("prefix token: provider", () => {
    it("extracts provider filter from provider:GITHUB token", () => {
      expect(parseSearchQuery("provider:GITHUB")).toEqual({
        keywords: [],
        provider: "GITHUB",
      });
    });

    it("extracts provider alongside keywords", () => {
      const result = parseSearchQuery("bug provider:JIRA");
      expect(result.keywords).toEqual(["bug"]);
      expect(result.provider).toBe("JIRA");
    });
  });

  describe("prefix token: project", () => {
    it("extracts project filter from project:sealion token", () => {
      expect(parseSearchQuery("project:sealion")).toEqual({
        keywords: [],
        project: "sealion",
      });
    });

    it('extracts project filter from project:"My Project" quoted token', () => {
      expect(parseSearchQuery('project:"My Project"')).toEqual({
        keywords: [],
        project: "My Project",
      });
    });

    it("handles project quoted token alongside other keywords", () => {
      const result = parseSearchQuery('bug project:"My Project" provider:GITHUB');
      expect(result.keywords).toEqual(["bug"]);
      expect(result.project).toBe("My Project");
      expect(result.provider).toBe("GITHUB");
    });
  });

  describe("prefix token: assignee", () => {
    it("extracts assignee:unassigned", () => {
      expect(parseSearchQuery("assignee:unassigned")).toEqual({
        keywords: [],
        assignee: "unassigned",
      });
    });

    it("extracts assignee:assigned", () => {
      expect(parseSearchQuery("assignee:assigned")).toEqual({
        keywords: [],
        assignee: "assigned",
      });
    });

    it("ignores unknown assignee values (treats as plain keyword)", () => {
      const result = parseSearchQuery("assignee:someuser");
      // unknown assignee value → treated as keyword token
      expect(result.keywords).toContain("assignee:someuser");
      expect(result.assignee).toBeUndefined();
    });
  });

  describe("prefix token: dueDate", () => {
    it("extracts dueDate:today filter", () => {
      expect(parseSearchQuery("dueDate:today")).toEqual({
        keywords: [],
        dueDateFilter: { preset: "today" },
      });
    });

    it("extracts dueDate:thisWeek filter", () => {
      expect(parseSearchQuery("dueDate:thisWeek")).toEqual({
        keywords: [],
        dueDateFilter: { preset: "thisWeek" },
      });
    });

    it("extracts dueDate:thisMonth filter", () => {
      expect(parseSearchQuery("dueDate:thisMonth")).toEqual({
        keywords: [],
        dueDateFilter: { preset: "thisMonth" },
      });
    });

    it("extracts dueDate:pastYear filter", () => {
      expect(parseSearchQuery("dueDate:pastYear")).toEqual({
        keywords: [],
        dueDateFilter: { preset: "pastYear" },
      });
    });

    it("extracts dueDate:none filter", () => {
      expect(parseSearchQuery("dueDate:none")).toEqual({
        keywords: [],
        dueDateFilter: { preset: "none" },
      });
    });

    it("ignores unknown dueDate preset values (treats as keyword)", () => {
      const result = parseSearchQuery("dueDate:invalid");
      expect(result.keywords).toContain("dueDate:invalid");
      expect(result.dueDateFilter).toBeUndefined();
    });
  });

  describe("combined tokens", () => {
    it("combines keywords and multiple prefix filters", () => {
      const result = parseSearchQuery('bug "login issue" provider:GITHUB assignee:unassigned');
      expect(result.keywords).toEqual(["bug", "login issue"]);
      expect(result.provider).toBe("GITHUB");
      expect(result.assignee).toBe("unassigned");
    });
  });
});

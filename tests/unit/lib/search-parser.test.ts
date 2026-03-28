/**
 * Unit tests for parseSearchQuery.
 * Tests cover: empty input, single keyword, multi-keyword OR split,
 * double-quoted phrase, unclosed quote, prefix tokens, and combinations.
 */

import { parseSearchQuery, serializeKeywords } from "@/lib/search-parser";

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

  describe("prefix token: createdDate", () => {
    it("extracts createdDate:today filter", () => {
      expect(parseSearchQuery("createdDate:today")).toEqual({
        keywords: [],
        createdFilter: { preset: "today" },
      });
    });

    it("extracts createdDate:past7days filter", () => {
      expect(parseSearchQuery("createdDate:past7days")).toEqual({
        keywords: [],
        createdFilter: { preset: "past7days" },
      });
    });

    it("extracts createdDate:past30days filter", () => {
      expect(parseSearchQuery("createdDate:past30days")).toEqual({
        keywords: [],
        createdFilter: { preset: "past30days" },
      });
    });

    it("extracts createdDate:pastYear filter", () => {
      expect(parseSearchQuery("createdDate:pastYear")).toEqual({
        keywords: [],
        createdFilter: { preset: "pastYear" },
      });
    });

    it("ignores unknown createdDate preset values (treats as keyword)", () => {
      const result = parseSearchQuery("createdDate:invalid");
      expect(result.keywords).toContain("createdDate:invalid");
      expect(result.createdFilter).toBeUndefined();
    });
  });

  describe("prefix token: updatedDate", () => {
    it("extracts updatedDate:today filter", () => {
      expect(parseSearchQuery("updatedDate:today")).toEqual({
        keywords: [],
        updatedFilter: { preset: "today" },
      });
    });

    it("extracts updatedDate:past7days filter", () => {
      expect(parseSearchQuery("updatedDate:past7days")).toEqual({
        keywords: [],
        updatedFilter: { preset: "past7days" },
      });
    });

    it("extracts updatedDate:past30days filter", () => {
      expect(parseSearchQuery("updatedDate:past30days")).toEqual({
        keywords: [],
        updatedFilter: { preset: "past30days" },
      });
    });

    it("extracts updatedDate:pastYear filter", () => {
      expect(parseSearchQuery("updatedDate:pastYear")).toEqual({
        keywords: [],
        updatedFilter: { preset: "pastYear" },
      });
    });

    it("ignores unknown updatedDate preset values (treats as keyword)", () => {
      const result = parseSearchQuery("updatedDate:invalid");
      expect(result.keywords).toContain("updatedDate:invalid");
      expect(result.updatedFilter).toBeUndefined();
    });
  });

  describe("combined tokens", () => {
    it("combines keywords and multiple prefix filters", () => {
      const result = parseSearchQuery('bug "login issue" provider:GITHUB assignee:unassigned');
      expect(result.keywords).toEqual(["bug", "login issue"]);
      expect(result.provider).toBe("GITHUB");
      expect(result.assignee).toBe("unassigned");
    });

    it("combines created/updated date filters with keywords", () => {
      const result = parseSearchQuery("bug createdDate:past7days updatedDate:past30days");
      expect(result.keywords).toEqual(["bug"]);
      expect(result.createdFilter).toEqual({ preset: "past7days" });
      expect(result.updatedFilter).toEqual({ preset: "past30days" });
    });
  });
});

describe("serializeKeywords", () => {
  it("returns empty string for empty array", () => {
    expect(serializeKeywords([])).toBe("");
  });

  it("joins single words with spaces", () => {
    expect(serializeKeywords(["bug", "fix"])).toBe("bug fix");
  });

  it("wraps multi-word keywords in double quotes", () => {
    expect(serializeKeywords(["login issue"])).toBe('"login issue"');
  });

  it("handles mix of single-word and multi-word keywords", () => {
    expect(serializeKeywords(["bug", "login issue", "crash"])).toBe('bug "login issue" crash');
  });

  it("round-trips correctly through parseSearchQuery", () => {
    const original = ["bug", "login issue"];
    const serialized = serializeKeywords(original);
    const parsed = parseSearchQuery(serialized);
    expect(parsed.keywords).toEqual(original);
  });
});

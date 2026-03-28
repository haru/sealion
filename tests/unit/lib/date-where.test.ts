import { buildDateWhere } from "@/lib/date-where";

describe("buildDateWhere", () => {
  it('returns { [field]: null } for preset "none"', () => {
    const result = buildDateWhere("dueDate", "none");
    expect(result).toEqual({ dueDate: null });
  });

  it("returns today range for preset 'today'", () => {
    const result = buildDateWhere("dueDate", "today");
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    expect(result).toEqual({ dueDate: { gte: start, lte: end } });
  });

  it("returns thisWeek range for preset 'thisWeek'", () => {
    const result = buildDateWhere("providerCreatedAt", "thisWeek");
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    expect(result).toEqual({ providerCreatedAt: { gte: start, lte: end } });
  });

  it("returns thisMonth range for preset 'thisMonth'", () => {
    const result = buildDateWhere("providerUpdatedAt", "thisMonth");
    const now = new Date();
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    expect(result).toEqual({ providerUpdatedAt: { gte: start, lte: end } });
  });

  it("returns past7days range for preset 'past7days'", () => {
    const result = buildDateWhere("dueDate", "past7days");
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    expect(result).toEqual({ dueDate: { gte: start } });
  });

  it("returns past30days range for preset 'past30days'", () => {
    const result = buildDateWhere("dueDate", "past30days");
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);

    expect(result).toEqual({ dueDate: { gte: start } });
  });

  it("returns pastYear range for preset 'pastYear'", () => {
    const result = buildDateWhere("dueDate", "pastYear");
    const now = new Date();
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);

    expect(result).toEqual({ dueDate: { gte: start } });
  });

  it("returns empty object for unrecognised preset", () => {
    const result = buildDateWhere("dueDate", "invalid");
    expect(result).toEqual({});
  });
});

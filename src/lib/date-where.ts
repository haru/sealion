/**
 * Converts a date range preset string to a Prisma date filter for the given field.
 * @param field - The Prisma Issue field name to filter on.
 * @param preset - The date range preset string.
 * @returns A partial Prisma where object, or an empty object if the preset is unrecognised.
 */
export function buildDateWhere(
  field: "dueDate" | "providerCreatedAt" | "providerUpdatedAt",
  preset: string,
): Record<string, unknown> {
  const now = new Date();

  if (preset === "none") {
    return { [field]: null };
  }

  const start = new Date(now);
  const end = new Date(now);

  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { [field]: { gte: start, lte: end } };
  }

  if (preset === "thisWeek") {
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setDate(now.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { [field]: { gte: start, lte: end } };
  }

  if (preset === "thisMonth") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { [field]: { gte: start, lte: end } };
  }

  if (preset === "past7days") {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { [field]: { gte: start } };
  }

  if (preset === "past30days") {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { [field]: { gte: start } };
  }

  if (preset === "pastYear") {
    start.setFullYear(now.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
    return { [field]: { gte: start } };
  }

  return {};
}

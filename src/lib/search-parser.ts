/**
 * Search query parser for the task search feature.
 * Converts a raw user input string into a structured {@link ParsedQuery}.
 */

/** Valid date range presets. "none" means no due date (dueDate filter only). */
export type DateRangePreset = "today" | "thisWeek" | "thisMonth" | "pastYear" | "none";

/** Valid date range presets for created/updated filters (no "none" option). */
export type CreatedUpdatedPreset = "today" | "past7days" | "past30days" | "pastYear";

/** A single date filter selection. */
export interface DateFilter {
  /** The selected preset value. */
  preset: DateRangePreset;
}

/**
 * The parsed result of a raw user search string.
 * Keywords are combined with OR; all other fields are ANDed with each other and with the keywords.
 */
export interface ParsedQuery {
  /** Title search keywords (OR condition). */
  keywords: string[];
  /** Provider type filter (e.g. "GITHUB"). */
  provider?: string;
  /** Project display name filter (partial match). */
  project?: string;
  /** Due date range filter. */
  dueDateFilter?: DateFilter;
  /** Created date range filter. */
  createdFilter?: DateFilter;
  /** Updated date range filter. */
  updatedFilter?: DateFilter;
  /** Assignee filter. */
  assignee?: "unassigned" | "assigned";
}

const DUE_DATE_PRESETS: ReadonlySet<string> = new Set<DateRangePreset>([
  "today",
  "thisWeek",
  "thisMonth",
  "pastYear",
  "none",
]);

const CREATED_UPDATED_PRESETS: ReadonlySet<string> = new Set<CreatedUpdatedPreset>([
  "today",
  "past7days",
  "past30days",
  "pastYear",
]);

/**
 * Tokenises a raw query string, respecting double-quoted phrases.
 * Also handles the `key:"value with spaces"` pattern used when appending filter
 * tokens that contain spaces (e.g. project names).
 * Unclosed quotes cause the content to be split as plain tokens.
 * @param raw - The raw input string.
 * @returns An array of token strings.
 */
function tokenise(raw: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < raw.length) {
    // Skip whitespace
    while (i < raw.length && raw[i] === " ") i++;
    if (i >= raw.length) break;

    if (raw[i] === '"') {
      // Standalone quoted phrase
      const closeIdx = raw.indexOf('"', i + 1);
      if (closeIdx !== -1) {
        // Properly closed quoted phrase
        const phrase = raw.slice(i + 1, closeIdx).trim();
        if (phrase.length > 0) tokens.push(phrase);
        i = closeIdx + 1;
      } else {
        // Unclosed quote — treat remaining content as plain tokens
        const rest = raw.slice(i + 1).trim();
        if (rest.length > 0) {
          tokens.push(...rest.split(/\s+/).filter((t) => t.length > 0));
        }
        break;
      }
    } else {
      // Plain token or key:"value with spaces" pattern.
      // Read character by character until whitespace, but if we encounter
      // the pattern `:"` (quote immediately after colon), extend the token
      // to include the entire quoted value.
      let end = i;
      while (end < raw.length && raw[end] !== " ") {
        if (raw[end] === '"' && end > i && raw[end - 1] === ":") {
          // key:"value" pattern: extend token to closing quote
          const closeQuote = raw.indexOf('"', end + 1);
          if (closeQuote !== -1) {
            end = closeQuote + 1;
          } else {
            end = raw.length; // unclosed quote — include remainder
          }
          break;
        }
        end++;
      }
      tokens.push(raw.slice(i, end));
      i = end;
    }
  }

  return tokens;
}

/**
 * Parses a raw search query string into a {@link ParsedQuery}.
 * Tokens matching `key:value` patterns are extracted as filter fields;
 * all remaining tokens become OR-combined keywords.
 * @param raw - The raw search input from the user.
 * @returns A structured {@link ParsedQuery}.
 */
export function parseSearchQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { keywords: [] };

  const tokens = tokenise(trimmed);
  const result: ParsedQuery = { keywords: [] };

  for (const token of tokens) {
    const colonIdx = token.indexOf(":");
    if (colonIdx > 0) {
      const key = token.slice(0, colonIdx);
      // Strip surrounding quotes added by the key:"value with spaces" pattern
      const rawValue = token.slice(colonIdx + 1);
      const value =
        rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length > 2
          ? rawValue.slice(1, -1)
          : rawValue;

      if (key === "provider" && value.length > 0) {
        result.provider = value;
        continue;
      }
      if (key === "project" && value.length > 0) {
        result.project = value;
        continue;
      }
      if (key === "assignee" && (value === "unassigned" || value === "assigned")) {
        result.assignee = value;
        continue;
      }
      if (key === "dueDate" && DUE_DATE_PRESETS.has(value)) {
        result.dueDateFilter = { preset: value as DateRangePreset };
        continue;
      }
      if (key === "createdDate" && CREATED_UPDATED_PRESETS.has(value)) {
        result.createdFilter = { preset: value as DateRangePreset };
        continue;
      }
      if (key === "updatedDate" && CREATED_UPDATED_PRESETS.has(value)) {
        result.updatedFilter = { preset: value as DateRangePreset };
        continue;
      }
    }

    // Not a recognised prefix token → treat as keyword
    result.keywords.push(token);
  }

  return result;
}

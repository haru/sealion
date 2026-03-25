import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import {
  BoardSettings,
  DEFAULT_BOARD_SETTINGS,
  VALID_SORT_CRITERIA,
  SortCriterion,
} from "@/lib/types";

/**
 * GET /api/board-settings
 *
 * Returns the authenticated user's board display and sort settings.
 * If no record exists in the database, returns the default values without creating a row.
 *
 * @returns 200 with {@link BoardSettings} data, or 401 if not authenticated.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const record = await prisma.boardSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (!record) {
    return ok<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  }

  const sortOrder = Array.isArray(record.sortOrder)
    ? (record.sortOrder as SortCriterion[])
    : (DEFAULT_BOARD_SETTINGS.sortOrder as SortCriterion[]);

  return ok<BoardSettings>({
    showCreatedAt: record.showCreatedAt,
    showUpdatedAt: record.showUpdatedAt,
    sortOrder,
  });
}

/**
 * PUT /api/board-settings
 *
 * Creates or updates the authenticated user's board settings (upsert).
 *
 * @returns 200 with the saved {@link BoardSettings}, 400 if validation fails, or 401 if not authenticated.
 */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_INPUT", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).showCreatedAt !== "boolean" ||
    typeof (body as Record<string, unknown>).showUpdatedAt !== "boolean"
  ) {
    return fail("INVALID_INPUT", 400);
  }

  const { showCreatedAt, showUpdatedAt, sortOrder } = body as {
    showCreatedAt: boolean;
    showUpdatedAt: boolean;
    sortOrder: unknown;
  };

  if (
    !Array.isArray(sortOrder) ||
    sortOrder.length < 1 ||
    sortOrder.length > 3 ||
    !sortOrder.every((v) => VALID_SORT_CRITERIA.includes(v as SortCriterion))
  ) {
    return fail("INVALID_INPUT", 400);
  }

  const saved = await prisma.boardSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      showCreatedAt,
      showUpdatedAt,
      sortOrder: sortOrder as SortCriterion[],
    },
    update: {
      showCreatedAt,
      showUpdatedAt,
      sortOrder: sortOrder as SortCriterion[],
    },
  });

  const savedSortOrder = Array.isArray(saved.sortOrder)
    ? (saved.sortOrder as SortCriterion[])
    : DEFAULT_BOARD_SETTINGS.sortOrder;

  return ok<BoardSettings>({
    showCreatedAt: saved.showCreatedAt,
    showUpdatedAt: saved.showUpdatedAt,
    sortOrder: savedSortOrder,
  });
}

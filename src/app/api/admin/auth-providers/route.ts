/**
 * Admin CRUD for `AuthProvider` rows — list + create.
 * Re-checks `role === "ADMIN"` per Constitution Principle II (two-layer defence),
 * even though `middleware.ts` already gates `/api/admin/*`.
 */

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { fail, failWithDetails, ok } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import {
  AuthProviderCreateSchema,
  countLinkedAccounts,
  create,
  listAll,
} from "@/services/auth-provider";
import { AUTH_PROVIDERS_CACHE_TAG } from "@/services/auth-provider/repository";

/**
 * Serialises an AuthProvider record to its public API shape.
 *
 * @param record - The raw AuthProvider record from the database.
 * @returns The public-safe representation.
 */
function publicShape(record: {
  id: string;
  providerId: string;
  type: string;
  displayName: string;
  enabled: boolean;
  issuerUrl: string | null;
  clientId: string;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    providerId: record.providerId,
    type: record.type,
    displayName: record.displayName,
    enabled: record.enabled,
    issuerUrl: record.issuerUrl,
    clientId: record.clientId,
    scope: record.scope,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Lists all AuthProviders with linked account counts (admin only).
 *
 * @returns `200` with an array of providers and their linked account counts.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) { return fail("UNAUTHORIZED", 401); }
    if (session.user.role !== "ADMIN") { return fail("FORBIDDEN", 403); }

    const rows = await listAll();
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...publicShape(row),
        linkedAccountCount: await countLinkedAccounts(row.providerId),
      })),
    );

    return ok(data);
  } catch (error: unknown) {
    console.error("[api/admin/auth-providers GET]", error);
    return fail("INTERNAL_ERROR", 500);
  }
}

/**
 * Creates a new AuthProvider (admin only).
 *
 * @param req - The incoming HTTP request with the create payload.
 * @returns `201` with the created provider, or an error response.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) { return fail("UNAUTHORIZED", 401); }
    if (session.user.role !== "ADMIN") { return fail("FORBIDDEN", 403); }
  } catch (error: unknown) {
    console.error("[api/admin/auth-providers POST auth]", error);
    return fail("INTERNAL_ERROR", 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_INPUT", 400);
  }

  const parsed = AuthProviderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return failWithDetails("INVALID_INPUT", parsed.error.issues, 400);
  }

  try {
    const session = await auth();
    const created = await create(parsed.data, session?.user?.id);
    revalidateTag(AUTH_PROVIDERS_CACHE_TAG, "");
    return ok(publicShape(created), 201);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail("PROVIDER_ID_TAKEN", 409);
    }
    console.error("[api/admin/auth-providers POST]", error);
    return fail("INTERNAL_ERROR", 500);
  }
}

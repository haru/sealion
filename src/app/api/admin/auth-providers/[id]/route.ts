/**
 * PATCH /api/admin/auth-providers/[id] — partial update for a provider.
 * DELETE /api/admin/auth-providers/[id] — deletes a provider (409 if linked accounts exist).
 * Both re-check admin role (Constitution II two-layer defense).
 */

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { fail, failWithDetails, ok } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import {
  countLinkedAccounts,
  findById,
  remove,
  update,
  AUTH_PROVIDERS_CACHE_TAG,
} from "@/services/auth-provider/repository";
import { AuthProviderUpdateSchema } from "@/services/auth-provider/schemas";

/**
 * Serialises an AuthProvider record to its public API shape.
 *
 * @param record - The raw AuthProvider record from the database.
 * @returns The public-safe representation with ISO date strings.
 */
function toPublic(record: {
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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Partially updates an AuthProvider by ID (admin only).
 *
 * @param request - The incoming HTTP request with the update payload.
 * @param params - Route parameters containing the provider UUID.
 * @returns `200` with the updated provider, or an error response.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return fail("FORBIDDEN", 403);
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_INPUT", 400);
  }

  const parsed = AuthProviderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_INPUT", 400);
  }

  const existing = await findById(id);
  if (!existing) {
    return fail("NOT_FOUND", 404);
  }

  try {
    const updated = await update(id, parsed.data, session.user.id);
    revalidateTag(AUTH_PROVIDERS_CACHE_TAG, "");
    return ok(toPublic(updated));
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail("NOT_FOUND", 404);
    }
    console.error("[api/admin/auth-providers PATCH]", error);
    return fail("INTERNAL_ERROR", 500);
  }
}

/**
 * Deletes an AuthProvider by ID (admin only).
 *
 * @param request - The incoming HTTP request.
 * @param params - Route parameters containing the provider UUID.
 * @returns `204` on success, `409` if linked accounts exist, or an error response.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return fail("FORBIDDEN", 403);
  }

  const { id } = await params;
  const existing = await findById(id);
  if (!existing) {
    return fail("NOT_FOUND", 404);
  }

  const linked = await countLinkedAccounts(existing.providerId);
  if (linked > 0) {
    return failWithDetails("PROVIDER_IN_USE", { linkedAccountCount: linked }, 409);
  }

  try {
    await remove(id);
    revalidateTag(AUTH_PROVIDERS_CACHE_TAG, "");
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail("NOT_FOUND", 404);
    }
    console.error("[api/admin/auth-providers DELETE]", error);
    return fail("INTERNAL_ERROR", 500);
  }
}

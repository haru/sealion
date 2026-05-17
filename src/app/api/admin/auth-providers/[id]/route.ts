/**
 * PATCH /api/admin/auth-providers/[id] — partial update for a provider.
 * DELETE /api/admin/auth-providers/[id] — deletes a provider (409 if linked accounts exist).
 * Both re-check admin role (Constitution II two-layer defense).
 */

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
 * Strips the decrypted `clientSecret` and serialises dates to ISO strings
 * before returning to the client.
 *
 * @param record - The decrypted provider record.
 * @returns A safe public view of the record.
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
 * Partially updates a provider. Omitted fields keep their existing values.
 * Calls `revalidateTag("auth-providers")` on success.
 *
 * @param request - The incoming PATCH request.
 * @param context - Route context with the `id` param.
 * @returns 200 with the updated row, or an error response.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const parsed = AuthProviderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const existing = await findById(id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const updated = await update(id, parsed.data, session.user.id);
    revalidateTag(AUTH_PROVIDERS_CACHE_TAG, "");
    return NextResponse.json({ success: true, data: toPublic(updated) }, { status: 200 });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[api/admin/auth-providers PATCH]", error);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * Deletes a provider. Returns 409 PROVIDER_IN_USE if linked Accounts exist.
 *
 * @param request - The incoming DELETE request.
 * @param context - Route context with the `id` param.
 * @returns 204 on success, or an error response.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await findById(id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const linked = await countLinkedAccounts(existing.providerId);
  if (linked > 0) {
    return NextResponse.json(
      { success: false, error: "PROVIDER_IN_USE", linkedAccountCount: linked },
      { status: 409 },
    );
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
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[api/admin/auth-providers DELETE]", error);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * Admin CRUD for `AuthProvider` rows — list + create.
 * Re-checks `role === "ADMIN"` per Constitution Principle II (two-layer defence),
 * even though `middleware.ts` already gates `/api/admin/*`.
 */

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import {
  AuthProviderCreateSchema,
  countLinkedAccounts,
  create,
  listAll,
} from "@/services/auth-provider";
import { AUTH_PROVIDERS_CACHE_TAG } from "@/services/auth-provider/repository";

/** Strips the decrypted `clientSecret` before serialising a record. */
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
 * Lists all providers (enabled + disabled) with `linkedAccountCount` for the admin UI.
 *
 * @returns 200 with `{ success: true, data: [...] }`, 401 if unauthenticated, 403 if not admin.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const rows = await listAll();
  const data = await Promise.all(
    rows.map(async (row) => ({
      ...publicShape(row),
      linkedAccountCount: await countLinkedAccounts(row.providerId),
    })),
  );

  return NextResponse.json({ success: true, data }, { status: 200 });
}

/**
 * Creates a new auth provider. Validates with Zod, encrypts `clientSecret`,
 * and invalidates the `auth-providers` cache tag on success.
 *
 * @param req - The incoming Next.js request.
 * @returns 201 on success, 400 INVALID_INPUT on Zod failure, 409 PROVIDER_ID_TAKEN on duplicate.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const parsed = AuthProviderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "INVALID_INPUT", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const created = await create(parsed.data, session.user.id);
    revalidateTag(AUTH_PROVIDERS_CACHE_TAG, "");
    return NextResponse.json(
      { success: true, data: publicShape(created) },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, error: "PROVIDER_ID_TAKEN" },
        { status: 409 },
      );
    }
    console.error("[api/admin/auth-providers POST]", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

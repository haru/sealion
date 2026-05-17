/**
 * Data-access layer for the `AuthProvider` table.
 * Owns encryption of `clientSecret` at write and decryption at read, and exposes
 * a cached `listEnabled()` for the Auth.js dynamic-config hot path.
 */

import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/db";
import { decrypt, encrypt } from "@/lib/encryption/encryption";

import type {
  AuthProviderCreateInput,
  AuthProviderUpdateInput,
} from "./schemas";
import type { AuthProviderRecord, AuthProviderType } from "./types";

/** Cache tag used by `listEnabled` + admin write handlers (`revalidateTag`). */
export const AUTH_PROVIDERS_CACHE_TAG = "auth-providers";
const LIST_ENABLED_TTL_SECONDS = 30;

type AuthProviderRow = {
  id: string;
  providerId: string;
  type: AuthProviderType;
  displayName: string;
  enabled: boolean;
  issuerUrl: string | null;
  clientId: string;
  encryptedClientSecret: string;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
};

/**
 * Decrypts a DB row into the app-facing {@link AuthProviderRecord}.
 *
 * @param row - The raw Prisma row.
 * @returns The decrypted record.
 * @throws If the stored `encryptedClientSecret` cannot be decrypted (tamper / key rotation).
 */
function toRecord(row: AuthProviderRow): AuthProviderRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    type: row.type,
    displayName: row.displayName,
    enabled: row.enabled,
    issuerUrl: row.issuerUrl,
    clientId: row.clientId,
    clientSecret: decrypt(row.encryptedClientSecret),
    scope: row.scope,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  };
}

/**
 * Returns every `AuthProvider` row, decrypted and ordered by `createdAt ASC`.
 *
 * @returns All provider records (enabled and disabled).
 */
export async function listAll(): Promise<AuthProviderRecord[]> {
  const rows = await prisma.authProvider.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRecord);
}

/**
 * Cached lookup of enabled providers for the Auth.js dynamic-config path.
 * TTL = 30s. Invalidated explicitly via `revalidateTag("auth-providers")`
 * from the admin write handlers.
 *
 * @returns Enabled provider records, ordered by `createdAt ASC`.
 */
export const listEnabled = unstable_cache(
  async (): Promise<AuthProviderRecord[]> => {
    const rows = await prisma.authProvider.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  },
  ["auth-providers:list-enabled"],
  { tags: [AUTH_PROVIDERS_CACHE_TAG], revalidate: LIST_ENABLED_TTL_SECONDS },
);

/**
 * Looks up a provider by primary key.
 *
 * @param id - The cuid PK.
 * @returns The decrypted record, or `null` if no row matches.
 */
export async function findById(id: string): Promise<AuthProviderRecord | null> {
  const row = await prisma.authProvider.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

/**
 * Looks up a provider by its public Auth.js key.
 *
 * @param providerId - The unique `providerId` (e.g. `"google"`).
 * @returns The decrypted record, or `null` if no row matches.
 */
export async function findByProviderId(
  providerId: string,
): Promise<AuthProviderRecord | null> {
  const row = await prisma.authProvider.findUnique({ where: { providerId } });
  return row ? toRecord(row) : null;
}

/**
 * Creates a new provider. The `clientSecret` is AES-256-GCM-encrypted at write.
 *
 * @param input - Validated {@link AuthProviderCreateInput}.
 * @param createdById - ID of the admin performing the operation, for audit.
 * @returns The decrypted, freshly-created record.
 * @throws Prisma `P2002` if `providerId` already exists; caller maps to 409.
 */
export async function create(
  input: AuthProviderCreateInput,
  createdById: string | null = null,
): Promise<AuthProviderRecord> {
  const issuerUrl =
    input.type === "OIDC_GENERIC" || input.type === "MICROSOFT_ENTRA"
      ? (input.issuerUrl ?? null)
      : null;

  const row = await prisma.authProvider.create({
    data: {
      providerId: input.providerId,
      type: input.type,
      displayName: input.displayName,
      enabled: input.enabled,
      issuerUrl,
      clientId: input.clientId,
      encryptedClientSecret: encrypt(input.clientSecret),
      scope: input.scope ?? null,
      createdById,
      updatedById: createdById,
    },
  });
  return toRecord(row);
}

/**
 * Partial update for a provider. Omitted fields are preserved; if `clientSecret`
 * is omitted, the previous encrypted value is kept.
 *
 * @param id - Target row PK.
 * @param input - Validated {@link AuthProviderUpdateInput}.
 * @param updatedById - ID of the admin performing the operation, for audit.
 * @returns The decrypted, updated record.
 * @throws Prisma `P2025` if no row matches `id`; caller maps to 404.
 */
export async function update(
  id: string,
  input: AuthProviderUpdateInput,
  updatedById: string | null = null,
): Promise<AuthProviderRecord> {
  const data: Prisma.AuthProviderUpdateInput = {
    updatedById,
  };

  if (input.displayName !== undefined) { data.displayName = input.displayName; }
  if (input.enabled !== undefined) { data.enabled = input.enabled; }
  if (input.issuerUrl !== undefined) { data.issuerUrl = input.issuerUrl; }
  if (input.clientId !== undefined) { data.clientId = input.clientId; }
  if (input.scope !== undefined) { data.scope = input.scope; }
  if (input.clientSecret !== undefined) {
    data.encryptedClientSecret = encrypt(input.clientSecret);
  }

  const row = await prisma.authProvider.update({ where: { id }, data });
  return toRecord(row);
}

/**
 * Deletes the provider. Caller MUST first verify that `countLinkedAccounts(providerId) === 0`.
 *
 * @param id - Target row PK.
 * @throws Prisma `P2025` if no row matches.
 */
export async function remove(id: string): Promise<void> {
  await prisma.authProvider.delete({ where: { id } });
}

/**
 * Counts `Account` rows linked to the given `providerId`. Used to gate DELETE
 * with a `409 PROVIDER_IN_USE` response.
 *
 * @param providerId - The provider key to check (matches `Account.provider`).
 * @returns The number of linked accounts.
 */
export async function countLinkedAccounts(providerId: string): Promise<number> {
  return prisma.account.count({ where: { provider: providerId } });
}

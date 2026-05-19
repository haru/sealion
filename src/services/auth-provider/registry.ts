/**
 * In-memory registry mapping {@link AuthProviderType} → {@link AuthProviderMetadata}.
 * Populated by `metadata.ts` at module load.
 */

import type { AuthProviderMetadata, AuthProviderType } from "./types";

const registry = new Map<AuthProviderType, AuthProviderMetadata>();

/**
 * Registers metadata for a provider type. Called once per type at module load
 * from `metadata.ts`. Idempotent: a second registration replaces the first.
 *
 * @param metadata - The {@link AuthProviderMetadata} entry to register.
 */
export function registerAuthProvider(metadata: AuthProviderMetadata): void {
  registry.set(metadata.type, metadata);
}

/**
 * Returns the metadata for `type`, or `undefined` if no entry is registered.
 *
 * @param type - The {@link AuthProviderType} to look up.
 * @returns The matching {@link AuthProviderMetadata}, or `undefined`.
 */
export function getAuthProviderMetadata(
  type: AuthProviderType,
): AuthProviderMetadata | undefined {
  return registry.get(type);
}

/**
 * Returns all registered provider metadata, sorted by `displayName` ascending
 * (case-insensitive, locale-aware via `localeCompare`).
 *
 * @returns Array of every registered {@link AuthProviderMetadata}.
 */
export function getAllAuthProviders(): AuthProviderMetadata[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
  );
}

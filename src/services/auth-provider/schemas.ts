/**
 * Zod schemas for validating admin create / update payloads on the `AuthProvider` table.
 * Used by the admin API route handlers and (via `z.infer`) by client-side form code.
 */

import { z } from "zod";

import { AuthProviderType } from "./types";

const typesRequiringIssuer = [
  AuthProviderType.OIDC_GENERIC,
  AuthProviderType.MICROSOFT_ENTRA,
] as const;

/** Provider IDs reserved for built-in Auth.js providers. */
const RESERVED_PROVIDER_IDS = ["credentials"] as const;

const providerIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/u, "providerId must be kebab-case (a-z, 0-9, -)")
  .refine(
    (v) => !RESERVED_PROVIDER_IDS.includes(v as typeof RESERVED_PROVIDER_IDS[number]),
    "providerId is reserved and cannot be used",
  );

/**
 * Validates the request body for `POST /api/admin/auth-providers`.
 * Enforces the conditional `issuerUrl` requirement for OIDC-style providers.
 */
export const AuthProviderCreateSchema = z
  .object({
    providerId: providerIdSchema,
    type: z.enum([
      AuthProviderType.OIDC_GENERIC,
      AuthProviderType.GOOGLE,
      AuthProviderType.GITHUB,
      AuthProviderType.MICROSOFT_ENTRA,
    ]),
    displayName: z.string().min(1).max(100),
    enabled: z.boolean().default(true),
    issuerUrl: z.string().url().nullable().optional(),
    clientId: z.string().min(1).max(500),
    clientSecret: z.string().min(1).max(2000),
    scope: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) =>
      typesRequiringIssuer.includes(
        v.type as (typeof typesRequiringIssuer)[number],
      )
        ? !!v.issuerUrl
        : true,
    {
      message: "issuerUrl is required for OIDC_GENERIC and MICROSOFT_ENTRA",
      path: ["issuerUrl"],
    },
  );

/** Parsed shape of {@link AuthProviderCreateSchema}. */
export type AuthProviderCreateInput = z.infer<typeof AuthProviderCreateSchema>;

/**
 * Validates the request body for `PATCH /api/admin/auth-providers/[id]`.
 * `providerId` is immutable; `clientSecret` omitted means "keep existing".
 */
export const AuthProviderUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  issuerUrl: z.string().url().nullable().optional(),
  clientId: z.string().min(1).max(500).optional(),
  clientSecret: z.string().min(1).max(2000).optional(),
  scope: z.string().max(500).nullable().optional(),
});

/**
 * Validates an update payload against an existing provider's type.
 * Prevents clearing `issuerUrl` for types that require it.
 *
 * @param input - Parsed update input.
 * @param existingType - The provider type of the existing record.
 * @throws `z.ZodError` when issuerUrl is being cleared for a type that requires it.
 */
export function validateUpdateIssuerUrl(
  input: AuthProviderUpdateInput,
  existingType: AuthProviderType,
): void {
  if (
    input.issuerUrl === null &&
    typesRequiringIssuer.includes(existingType as (typeof typesRequiringIssuer)[number])
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "issuerUrl is required for this provider type and cannot be cleared",
        path: ["issuerUrl"],
      },
    ]);
  }
}

/** Parsed shape of {@link AuthProviderUpdateSchema}. */
export type AuthProviderUpdateInput = z.infer<typeof AuthProviderUpdateSchema>;

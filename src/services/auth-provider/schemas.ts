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

const providerIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/u, "providerId must be kebab-case (a-z, 0-9, -)");

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

/** Parsed shape of {@link AuthProviderUpdateSchema}. */
export type AuthProviderUpdateInput = z.infer<typeof AuthProviderUpdateSchema>;

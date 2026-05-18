/** @jest-environment node */
/**
 * Unit tests for AuthProvider Zod schemas.
 */

import {
  AuthProviderCreateSchema,
  AuthProviderUpdateSchema,
} from "@/services/auth-provider/schemas";

describe("AuthProviderCreateSchema", () => {
  const validGoogle = {
    providerId: "google",
    type: "GOOGLE",
    displayName: "Google",
    clientId: "client-id",
    clientSecret: "secret-value",
  };

  it("accepts a valid GOOGLE payload", () => {
    const result = AuthProviderCreateSchema.safeParse(validGoogle);
    expect(result.success).toBe(true);
  });

  it("accepts a valid GITHUB payload", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "github",
      type: "GITHUB",
      displayName: "GitHub",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid OIDC_GENERIC payload with issuerUrl", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "keycloak",
      type: "OIDC_GENERIC",
      displayName: "Keycloak",
      issuerUrl: "https://keycloak.example.com/realms/master",
    });
    expect(result.success).toBe(true);
  });

  it("rejects OIDC_GENERIC without issuerUrl", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "keycloak",
      type: "OIDC_GENERIC",
      displayName: "Keycloak",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuerIssue = result.error.issues.find((i) => i.path.includes("issuerUrl"));
      expect(issuerIssue).toBeDefined();
    }
  });

  it("rejects MICROSOFT_ENTRA without issuerUrl", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "entra",
      type: "MICROSOFT_ENTRA",
      displayName: "Entra",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuerIssue = result.error.issues.find((i) => i.path.includes("issuerUrl"));
      expect(issuerIssue).toBeDefined();
    }
  });

  it("accepts MICROSOFT_ENTRA with issuerUrl", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "entra",
      type: "MICROSOFT_ENTRA",
      displayName: "Microsoft Entra",
      issuerUrl: "https://login.microsoftonline.com/common/v2.0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects providerId with uppercase letters", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "Google",
    });
    expect(result.success).toBe(false);
  });

  it("rejects providerId shorter than 2 characters", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects providerId longer than 64 characters", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "a".repeat(65),
    });
    expect(result.success).toBe(false);
  });

  it("rejects providerId with spaces", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      providerId: "my provider",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty displayName", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty clientId", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      clientId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty clientSecret", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      clientSecret: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid type", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      type: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("defaults enabled to true when omitted", () => {
    const result = AuthProviderCreateSchema.safeParse(validGoogle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });

  it("accepts enabled: false", () => {
    const result = AuthProviderCreateSchema.safeParse({ ...validGoogle, enabled: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
    }
  });

  it("accepts null issuerUrl for GOOGLE", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      issuerUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts scope as null", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      scope: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts scope as a string", () => {
    const result = AuthProviderCreateSchema.safeParse({
      ...validGoogle,
      scope: "openid email profile",
    });
    expect(result.success).toBe(true);
  });
});

describe("AuthProviderUpdateSchema", () => {
  it("accepts an empty object (no-op update)", () => {
    const result = AuthProviderUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts displayName update", () => {
    const result = AuthProviderUpdateSchema.safeParse({ displayName: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts enabled update", () => {
    const result = AuthProviderUpdateSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });

  it("accepts issuerUrl update as a URL string", () => {
    const result = AuthProviderUpdateSchema.safeParse({
      issuerUrl: "https://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts issuerUrl update as null", () => {
    const result = AuthProviderUpdateSchema.safeParse({ issuerUrl: null });
    expect(result.success).toBe(true);
  });

  it("accepts clientId update", () => {
    const result = AuthProviderUpdateSchema.safeParse({ clientId: "new-id" });
    expect(result.success).toBe(true);
  });

  it("accepts clientSecret update", () => {
    const result = AuthProviderUpdateSchema.safeParse({ clientSecret: "new-secret" });
    expect(result.success).toBe(true);
  });

  it("accepts scope update as string", () => {
    const result = AuthProviderUpdateSchema.safeParse({ scope: "openid email" });
    expect(result.success).toBe(true);
  });

  it("accepts scope update as null", () => {
    const result = AuthProviderUpdateSchema.safeParse({ scope: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty displayName", () => {
    const result = AuthProviderUpdateSchema.safeParse({ displayName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty clientId", () => {
    const result = AuthProviderUpdateSchema.safeParse({ clientId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty clientSecret", () => {
    const result = AuthProviderUpdateSchema.safeParse({ clientSecret: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid issuerUrl (not a URL)", () => {
    const result = AuthProviderUpdateSchema.safeParse({ issuerUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts unknown fields (not strict — extra keys are stripped)", () => {
    const result = AuthProviderUpdateSchema.safeParse({ unknownField: "value" });
    expect(result.success).toBe(true);
  });
});

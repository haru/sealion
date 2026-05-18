/** @jest-environment node */
/**
 * Unit tests for the auth-provider metadata registry.
 * Verifies that all four built-in IdP types register, expose the correct
 * `requiresIssuerUrl` flags, and produce valid Auth.js provider configs.
 */

import { AuthProviderType } from "@prisma/client";

import {
  getAllAuthProviders,
  getAuthProviderMetadata,
} from "@/services/auth-provider/registry";
import type { AuthProviderRecord } from "@/services/auth-provider/types";

// Importing this module triggers the side-effecting registerAuthProvider calls.
import "@/services/auth-provider/metadata";

function makeRecord(
  type: AuthProviderType,
  overrides: Partial<AuthProviderRecord> = {},
): AuthProviderRecord {
  return {
    id: "rec_1",
    providerId: "test-provider",
    type,
    displayName: "Test Provider",
    enabled: true,
    issuerUrl: type === AuthProviderType.OIDC_GENERIC || type === AuthProviderType.MICROSOFT_ENTRA
      ? "https://issuer.example.com"
      : null,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    scope: null,
    createdAt: new Date("2026-05-17T00:00:00Z"),
    updatedAt: new Date("2026-05-17T00:00:00Z"),
    createdById: null,
    updatedById: null,
    ...overrides,
  };
}

describe("auth-provider metadata", () => {
  it("registers all four built-in IdP types", () => {
    const all = getAllAuthProviders();
    const types = all.map((m) => m.type).sort();
    expect(types).toEqual(
      [
        AuthProviderType.GITHUB,
        AuthProviderType.GOOGLE,
        AuthProviderType.MICROSOFT_ENTRA,
        AuthProviderType.OIDC_GENERIC,
      ].sort(),
    );
  });

  describe("requiresIssuerUrl flag", () => {
    it.each([
      [AuthProviderType.GOOGLE, false],
      [AuthProviderType.GITHUB, false],
      [AuthProviderType.MICROSOFT_ENTRA, true],
      [AuthProviderType.OIDC_GENERIC, true],
    ])("%s.requiresIssuerUrl === %s", (type, expected) => {
      const meta = getAuthProviderMetadata(type);
      expect(meta?.requiresIssuerUrl).toBe(expected);
    });
  });

  describe("GOOGLE", () => {
    it("builds an Auth.js provider with the record's providerId and clientId", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.GOOGLE);
      const record = makeRecord(AuthProviderType.GOOGLE, {
        providerId: "google",
        clientId: "google-client",
        clientSecret: "google-secret",
      });
      const provider = meta!.authJsProviderBuilder(record) as {
        id?: string;
        options?: { clientId?: string; clientSecret?: string; checks?: string[] };
      };
      expect(provider.id).toBe("google");
      expect(provider.options?.clientId).toBe("google-client");
      expect(provider.options?.clientSecret).toBe("google-secret");
      expect(provider.options?.checks).toEqual(
        expect.arrayContaining(["pkce", "state", "nonce"]),
      );
    });
  });

  describe("OIDC_GENERIC", () => {
    it("returns an oidc-typed config with pkce/state/nonce checks", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.OIDC_GENERIC);
      const record = makeRecord(AuthProviderType.OIDC_GENERIC, {
        providerId: "keycloak-corp",
        issuerUrl: "https://keycloak.example.com/realms/corp",
        clientId: "kc-client",
        clientSecret: "kc-secret",
      });
      const provider = meta!.authJsProviderBuilder(record) as {
        id: string;
        type: string;
        issuer: string;
        clientId: string;
        clientSecret: string;
        checks: string[];
      };
      expect(provider.id).toBe("keycloak-corp");
      expect(provider.type).toBe("oidc");
      expect(provider.issuer).toBe("https://keycloak.example.com/realms/corp");
      expect(provider.clientId).toBe("kc-client");
      expect(provider.clientSecret).toBe("kc-secret");
      expect(provider.checks).toEqual(["pkce", "state", "nonce"]);
    });

    it("honours the record's scope override when present", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.OIDC_GENERIC);
      const record = makeRecord(AuthProviderType.OIDC_GENERIC, {
        scope: "openid email profile groups",
      });
      const provider = meta!.authJsProviderBuilder(record) as {
        authorization: { params: { scope: string } };
      };
      expect(provider.authorization.params.scope).toBe("openid email profile groups");
    });

    it("falls back to the default scope when record.scope is null", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.OIDC_GENERIC);
      const record = makeRecord(AuthProviderType.OIDC_GENERIC, { scope: null });
      const provider = meta!.authJsProviderBuilder(record) as {
        authorization: { params: { scope: string } };
      };
      expect(provider.authorization.params.scope).toBe("openid email profile");
    });
  });

  describe("GITHUB (US2)", () => {
    it("builds an Auth.js provider with pkce/state checks (no nonce)", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.GITHUB);
      const record = makeRecord(AuthProviderType.GITHUB, {
        providerId: "github",
        clientId: "gh-client",
        clientSecret: "gh-secret",
      });
      const provider = meta!.authJsProviderBuilder(record) as {
        id?: string;
        options?: { clientId?: string; clientSecret?: string; checks?: string[] };
      };
      expect(provider.id).toBe("github");
      expect(provider.options?.clientId).toBe("gh-client");
      expect(provider.options?.clientSecret).toBe("gh-secret");
      expect(provider.options?.checks).toEqual(
        expect.arrayContaining(["pkce", "state"]),
      );
      expect(provider.options?.checks).not.toContain("nonce");
    });

    it("uses the default scope read:user user:email when record.scope is null", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.GITHUB);
      const record = makeRecord(AuthProviderType.GITHUB, { scope: null });
      const provider = meta!.authJsProviderBuilder(record) as {
        authorization: { params: { scope: string } };
      };
      expect(provider.authorization.params.scope).toBe("read:user user:email");
    });

    it("does not require an issuer URL", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.GITHUB);
      expect(meta?.requiresIssuerUrl).toBe(false);
    });
  });

  describe("MICROSOFT_ENTRA (US2)", () => {
    it("builds an Auth.js provider with pkce/state/nonce checks", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.MICROSOFT_ENTRA);
      const record = makeRecord(AuthProviderType.MICROSOFT_ENTRA, {
        providerId: "microsoft-entra-id",
        clientId: "entra-client",
        clientSecret: "entra-secret",
        issuerUrl: "https://login.microsoftonline.com/tenant-id/v2.0",
      });
      const provider = meta!.authJsProviderBuilder(record) as {
        id?: string;
        options?: { clientId?: string; clientSecret?: string; checks?: string[] };
      };
      expect(provider.id).toBe("microsoft-entra-id");
      expect(provider.options?.clientId).toBe("entra-client");
      expect(provider.options?.clientSecret).toBe("entra-secret");
      expect(provider.options?.checks).toEqual(
        expect.arrayContaining(["pkce", "state", "nonce"]),
      );
    });

    it("requires an issuer URL", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.MICROSOFT_ENTRA);
      expect(meta?.requiresIssuerUrl).toBe(true);
    });

    it("uses a sensible scope when record.scope is null", () => {
      const meta = getAuthProviderMetadata(AuthProviderType.MICROSOFT_ENTRA);
      const record = makeRecord(AuthProviderType.MICROSOFT_ENTRA, {
        issuerUrl: "https://login.microsoftonline.com/tenant/v2.0",
        scope: null,
      });
      const provider = meta!.authJsProviderBuilder(record) as {
        authorization: { params: { scope: string } };
      };
      expect(provider.authorization.params.scope).toContain("openid");
      expect(provider.authorization.params.scope).toContain("email");
    });
  });
});

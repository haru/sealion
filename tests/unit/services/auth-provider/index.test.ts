/** @jest-environment node */
/**
 * Unit tests for the auth-provider barrel export.
 */

describe("auth-provider barrel export", () => {
  it("re-exports AuthProviderType enum values", async () => {
    const mod = await import("@/services/auth-provider");
    expect(mod.AuthProviderType).toBeDefined();
    expect(mod.AuthProviderType.OIDC_GENERIC).toBe("OIDC_GENERIC");
    expect(mod.AuthProviderType.GOOGLE).toBe("GOOGLE");
    expect(mod.AuthProviderType.GITHUB).toBe("GITHUB");
    expect(mod.AuthProviderType.MICROSOFT_ENTRA).toBe("MICROSOFT_ENTRA");
  });

  it("re-exports AuthProviderCreateSchema", async () => {
    const mod = await import("@/services/auth-provider");
    expect(mod.AuthProviderCreateSchema).toBeDefined();
  });

  it("re-exports AuthProviderUpdateSchema", async () => {
    const mod = await import("@/services/auth-provider");
    expect(mod.AuthProviderUpdateSchema).toBeDefined();
  });

  it("re-exports repository functions", async () => {
    const mod = await import("@/services/auth-provider");
    expect(typeof mod.listAll).toBe("function");
    expect(typeof mod.listEnabled).toBe("function");
    expect(typeof mod.findById).toBe("function");
    expect(typeof mod.findByProviderId).toBe("function");
    expect(typeof mod.create).toBe("function");
    expect(typeof mod.update).toBe("function");
    expect(typeof mod.remove).toBe("function");
    expect(typeof mod.countLinkedAccounts).toBe("function");
  });

  it("re-exports registry functions", async () => {
    const mod = await import("@/services/auth-provider");
    expect(typeof mod.registerAuthProvider).toBe("function");
    expect(typeof mod.getAuthProviderMetadata).toBe("function");
    expect(typeof mod.getAllAuthProviders).toBe("function");
  });
});

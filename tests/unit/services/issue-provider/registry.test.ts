/** @jest-environment node */
import { getAllProviders, getProviderMetadata } from "@/services/issue-provider/registry";

describe("getAllProviders()", () => {
  it("returns exactly 5 providers", () => {
    expect(getAllProviders()).toHaveLength(5);
  });

  it("includes GITHUB, JIRA, REDMINE, GITLAB, and LINEAR", () => {
    const types = getAllProviders().map((p) => p.type);
    expect(types).toContain("GITHUB");
    expect(types).toContain("JIRA");
    expect(types).toContain("REDMINE");
    expect(types).toContain("GITLAB");
    expect(types).toContain("LINEAR");
  });

  it("returns providers with correct baseUrlMode", () => {
    const byType = Object.fromEntries(getAllProviders().map((p) => [p.type, p]));
    expect(byType["GITHUB"].baseUrlMode).toBe("none");
    expect(byType["JIRA"].baseUrlMode).toBe("required");
    expect(byType["REDMINE"].baseUrlMode).toBe("required");
    expect(byType["GITLAB"].baseUrlMode).toBe("optional");
    expect(byType["LINEAR"].baseUrlMode).toBe("none");
  });

  it("returns providers with correct displayName", () => {
    const byType = Object.fromEntries(getAllProviders().map((p) => [p.type, p]));
    expect(byType["GITHUB"].displayName).toBe("GitHub");
    expect(byType["JIRA"].displayName).toBe("Jira");
    expect(byType["REDMINE"].displayName).toBe("Redmine");
    expect(byType["GITLAB"].displayName).toBe("GitLab");
    expect(byType["LINEAR"].displayName).toBe("Linear");
  });

  it("returns providers with non-null iconUrl", () => {
    for (const provider of getAllProviders()) {
      expect(provider.iconUrl).not.toBeNull();
    }
  });

  it("returns providers with credentialFields array", () => {
    for (const provider of getAllProviders()) {
      expect(Array.isArray(provider.credentialFields)).toBe(true);
      expect(provider.credentialFields.length).toBeGreaterThan(0);
    }
  });

  it("GitHub has token credential field (password, required)", () => {
    const github = getProviderMetadata("GITHUB")!;
    expect(github.credentialFields).toEqual([
      { key: "token", labelKey: "token", inputType: "password", required: true },
    ]);
  });

  it("GitLab has token credential field (password, required)", () => {
    const gitlab = getProviderMetadata("GITLAB")!;
    expect(gitlab.credentialFields).toEqual([
      { key: "token", labelKey: "token", inputType: "password", required: true },
    ]);
  });

  it("Linear has apiKey credential field (password, required)", () => {
    const linear = getProviderMetadata("LINEAR")!;
    expect(linear.credentialFields).toEqual([
      { key: "apiKey", labelKey: "apiKey", inputType: "password", required: true },
    ]);
  });

  it("Jira has email and apiToken credential fields", () => {
    const jira = getProviderMetadata("JIRA")!;
    expect(jira.credentialFields).toEqual([
      { key: "email", labelKey: "email", inputType: "text", required: true },
      { key: "apiToken", labelKey: "apiToken", inputType: "password", required: true },
    ]);
  });

  it("Redmine has apiKey credential field (password, required)", () => {
    const redmine = getProviderMetadata("REDMINE")!;
    expect(redmine.credentialFields).toEqual([
      { key: "apiKey", labelKey: "apiKey", inputType: "password", required: true },
    ]);
  });
});

describe("getProviderMetadata()", () => {
  it("returns GitHub metadata for GITHUB", () => {
    const meta = getProviderMetadata("GITHUB");
    expect(meta).toBeDefined();
    expect(meta!.type).toBe("GITHUB");
  });

  it("returns Jira metadata for JIRA", () => {
    const meta = getProviderMetadata("JIRA");
    expect(meta).toBeDefined();
    expect(meta!.type).toBe("JIRA");
  });

  it("returns Redmine metadata for REDMINE", () => {
    const meta = getProviderMetadata("REDMINE");
    expect(meta).toBeDefined();
    expect(meta!.type).toBe("REDMINE");
  });

  it("returns GitLab metadata for GITLAB", () => {
    const meta = getProviderMetadata("GITLAB");
    expect(meta).toBeDefined();
    expect(meta!.type).toBe("GITLAB");
  });

  it("returns Linear metadata for LINEAR", () => {
    const meta = getProviderMetadata("LINEAR");
    expect(meta).toBeDefined();
    expect(meta!.type).toBe("LINEAR");
    expect(meta!.iconUrl).toBe("/providers/linear.svg");
    expect(meta!.baseUrlMode).toBe("none");
  });

  it("returns undefined for an unknown type", () => {
    expect(getProviderMetadata("UNKNOWN")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getProviderMetadata("")).toBeUndefined();
  });
});

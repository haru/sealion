/**
 * Unit tests for ProviderEditModal utilities — buildPatchBody.
 * @jest-environment node
 */

import { buildPatchBody } from "@/components/providers/ProviderEditModal";

describe("buildPatchBody", () => {
  const baseArgs = {
    displayName: "My Provider",
    changeCredentials: false,
    credentials: {},
    isRequired: false,
    isOptional: false,
    useCustomBaseUrl: false,
    baseUrl: "",
  };

  it("includes displayName and changeCredentials always", () => {
    const body = buildPatchBody(baseArgs);
    expect(body.displayName).toBe("My Provider");
    expect(body.changeCredentials).toBe(false);
  });

  it("does not include baseUrl when mode is neither required nor optional", () => {
    const body = buildPatchBody(baseArgs);
    expect(body).not.toHaveProperty("baseUrl");
  });

  it("includes baseUrl when isRequired is true", () => {
    const body = buildPatchBody({ ...baseArgs, isRequired: true, baseUrl: "https://jira.example.com" });
    expect(body.baseUrl).toBe("https://jira.example.com");
  });

  it("includes baseUrl when isOptional and useCustomBaseUrl are both true", () => {
    const body = buildPatchBody({
      ...baseArgs,
      isOptional: true,
      useCustomBaseUrl: true,
      baseUrl: "https://github.example.com",
    });
    expect(body.baseUrl).toBe("https://github.example.com");
  });

  it("sets baseUrl to empty string when isOptional but useCustomBaseUrl is false (clear URL)", () => {
    const body = buildPatchBody({
      ...baseArgs,
      isOptional: true,
      useCustomBaseUrl: false,
      baseUrl: "https://github.example.com",
    });
    expect(body.baseUrl).toBe("");
  });

  it("includes credentials when changeCredentials is true", () => {
    const body = buildPatchBody({
      ...baseArgs,
      changeCredentials: true,
      credentials: { token: "ghp_abc" },
    });
    expect(body.credentials).toEqual({ token: "ghp_abc" });
  });

  it("does not include credentials when changeCredentials is false", () => {
    const body = buildPatchBody({ ...baseArgs, changeCredentials: false, credentials: { token: "ghp_abc" } });
    expect(body).not.toHaveProperty("credentials");
  });
});

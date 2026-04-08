/** @jest-environment node */

jest.mock("@/services/issue-provider/github/github", () => ({
  GitHubAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/jira/jira", () => ({
  JiraAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/redmine/redmine", () => ({
  RedmineAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/gitlab/gitlab", () => ({
  GitLabAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/linear/linear", () => ({
  LinearAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/registry", () => ({
  getProviderMetadata: jest.fn(() => ({ type: "GITHUB", iconUrl: "/providers/github.svg" })),
}));

import { createAdapter } from "@/services/issue-provider/factory";

describe("createAdapter — post-enum removal (T010/T011)", () => {
  it("T010: creates adapter for any registered provider type string without enum dependency", () => {
    const adapter = createAdapter("GITHUB", { token: "test" });
    expect(adapter).toBeDefined();
    expect(adapter.testConnection).toBeDefined();
  });

  it("T011: throws a descriptive error for unknown type string", () => {
    expect(() => createAdapter("BITBUCKET", { token: "test" })).toThrow(
      "Unsupported provider type: BITBUCKET",
    );
  });
});

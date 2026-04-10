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

jest.mock("@/services/issue-provider/asana/asana", () => ({
  AsanaAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/trello/trello", () => ({
  TrelloAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/backlog/backlog", () => ({
  BacklogAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/services/issue-provider/registry", () => ({
  getProviderMetadata: jest.fn(() => ({ type: "GITHUB", iconUrl: "/providers/github.svg" })),
}));

import { AsanaAdapter } from "@/services/issue-provider/asana/asana";
import { BacklogAdapter } from "@/services/issue-provider/backlog/backlog";
import { createAdapter } from "@/services/issue-provider/factory";
import { TrelloAdapter } from "@/services/issue-provider/trello/trello";

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

  it("creates an AsanaAdapter for type ASANA", () => {
    const adapter = createAdapter("ASANA", { token: "asana-token" });
    expect(adapter).toBeDefined();
    expect(AsanaAdapter).toHaveBeenCalledWith("asana-token");
  });

  it("creates a TrelloAdapter for type TRELLO", () => {
    const adapter = createAdapter("TRELLO", { apiKey: "trello-key", apiToken: "trello-token" });
    expect(adapter).toBeDefined();
    expect(TrelloAdapter).toHaveBeenCalledWith("trello-key", "trello-token");
  });

  it("creates a BacklogAdapter for type BACKLOG", () => {
    const adapter = createAdapter("BACKLOG", { baseUrl: "https://myspace.backlog.com", apiKey: "backlog-key" });
    expect(adapter).toBeDefined();
    expect(BacklogAdapter).toHaveBeenCalledWith("https://myspace.backlog.com", "backlog-key");
  });
});

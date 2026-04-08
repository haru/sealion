/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

describe("Prisma IssueProvider.type field — post-migration schema validation", () => {
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
  });

  it("T003: IssueProvider.type should be String (not an enum)", () => {
    const modelMatch = schemaContent.match(/model\s+IssueProvider\s*\{([^}]+)\}/s);
    expect(modelMatch).not.toBeNull();

    const modelBody = modelMatch![1];

    const typeFieldMatch = modelBody.match(/type\s+(\S+)/);
    expect(typeFieldMatch).not.toBeNull();
    expect(typeFieldMatch![1]).toBe("String");
  });

  it("T004: ProviderType enum should not exist and known values are preserved as text", () => {
    expect(schemaContent).not.toContain("enum ProviderType");

    const knownValues = ["GITHUB", "JIRA", "REDMINE", "GITLAB", "LINEAR"];
    for (const value of knownValues) {
      expect(schemaContent).not.toContain(value);
    }
  });
});

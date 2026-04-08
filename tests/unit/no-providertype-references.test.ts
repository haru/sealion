/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";

describe("No ProviderType enum references in codebase (T019/T020)", () => {
  const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");
  const SRC_DIR = path.join(process.cwd(), "src");

  let schemaContent: string;
  let sourceFiles: string[];

  beforeAll(() => {
    schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    sourceFiles = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
            walk(full);
          }
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          sourceFiles.push(full);
        }
      }
    }
    walk(SRC_DIR);
  });

  it("T019: no source file under src/ imports ProviderType from @prisma/client", () => {
    const violatingFiles: string[] = [];
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (/import\s+.*ProviderType.*from\s+['"]@prisma\/client['"]/.test(content)) {
        const relative = path.relative(process.cwd(), file);
        violatingFiles.push(relative);
      }
    }
    expect(violatingFiles).toEqual([]);
  });

  it("T020: prisma/schema.prisma does not contain enum ProviderType", () => {
    expect(schemaContent).not.toContain("enum ProviderType");
  });
});

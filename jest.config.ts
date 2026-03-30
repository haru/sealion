import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/tests/(unit|integration)/**/*.test.ts?(x)"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    // Type declarations
    "!src/**/*.d.ts",
    // UI pages and layouts (tested via E2E)
    "!src/app/**/layout.tsx",
    "!src/app/**/page.tsx",
    // React components (tested via E2E)
    "!src/components/**",
    "!src/app/**/*.tsx",
    // Shared type definitions (no runtime code)
    "!src/types/**",
    // React hooks that are only testable via E2E (component lifecycle required)
    "!src/hooks/useSyncPolling.ts",
    // i18n and message files
    "!src/messages/**",
    "!src/i18n/**",
    // Config files (tested implicitly)
    "!src/lib/auth.config.ts",
    "!src/lib/auth.ts",
    "!src/lib/db.ts",
    "!src/lib/theme.ts",
    "!src/lib/types.ts",
    "!src/services/issue-provider/base.ts",
    // Auto-generated Auth.js handler (no unit test needed)
    "!src/app/api/auth/[...nextauth]/route.ts",
  ],
  coverageThreshold: {
    global: {
      lines: 95,
    },
  },
};

// createJestConfig overrides transformIgnorePatterns, so we wrap it
// to re-apply a pattern that ignores node_modules by default but
// allows next-intl (ESM) to be transformed by Babel/SWC.
const jestConfig = createJestConfig(config);
const resolvedConfig = async () => {
  const base = await (jestConfig as () => Promise<Config>)();
  return {
    ...base,
    transformIgnorePatterns: [
      "/node_modules/(?!(next-intl)/)",
    ],
  };
};
export default resolvedConfig;

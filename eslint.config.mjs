import stylistic from "@stylistic/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import reactPlugin from "eslint-plugin-react";
import tsdoc from "eslint-plugin-tsdoc";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      tsdoc,
      jsdoc,
      "@stylistic": stylistic,
      import: importPlugin,
      "unused-imports": unusedImports,
      react: reactPlugin,
      "@typescript-eslint": tsPlugin,
    },
    settings: {
      jsdoc: { mode: "typescript" },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      // ── TSDoc ────────────────────────────────────────────────────────────────
      "tsdoc/syntax": "warn",
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          checkConstructors: false,
        },
      ],

      // ── Code Format Unification ───────────────────────────────────────────
      "@stylistic/linebreak-style": ["error", "unix"],
      "@stylistic/no-multi-spaces": "error",
      "object-shorthand": "error",

      // ── React / JSX Format ────────────────────────────────────────────────
      "react/jsx-boolean-value": "error",
      "react/jsx-closing-bracket-location": "error",
      "react/jsx-closing-tag-location": "error",
      "react/jsx-curly-spacing": "error",
      "react/jsx-pascal-case": "error",
      "react/jsx-tag-spacing": "error",
      "react/jsx-wrap-multilines": "error",
      "react/self-closing-comp": "error",

      // ── Import Organization ───────────────────────────────────────────────
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          pathGroups: [
            {
              pattern: "@/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/no-duplicates": "error",

      // ── Naming Conventions ────────────────────────────────────────────────
      "@typescript-eslint/naming-convention": [
        "error",
        // Quoted properties (e.g. ESLint rule names, regex keys) — any format
        {
          selector: "objectLiteralProperty",
          modifiers: ["requiresQuotes"],
          format: null,
        },
        // Default: camelCase
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Variables: camelCase, UPPER_CASE, PascalCase (React components as variables)
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
        },
        // Parameters: camelCase with optional leading underscore
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // Import bindings: camelCase or PascalCase (React components, MUI, Next.js)
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        // Functions: camelCase or PascalCase (React component functions)
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        // Object literal properties: camelCase, PascalCase, UPPER_CASE, snake_case
        {
          selector: "objectLiteralProperty",
          format: ["camelCase", "PascalCase", "UPPER_CASE", "snake_case"],
          leadingUnderscore: "allow",
        },
        // Type-level constructs: PascalCase
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // Enum members: UPPER_CASE or PascalCase
        {
          selector: "enumMember",
          format: ["UPPER_CASE", "PascalCase"],
        },
      ],

      // ── Code Clarity ──────────────────────────────────────────────────────
      curly: "error",
      "no-implicit-coercion": ["error", { allow: ["!!"] }],

      // ── Unused Code Detection ─────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "unused-imports/no-unused-imports": "error",

      // ── Code Structure & Import Management ───────────────────────────────
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Relative parent imports are not allowed. Use absolute imports with @/* instead.",
            },
          ],
        },
      ],
      "react/no-multi-comp": "error",

      // ── Complexity Control ────────────────────────────────────────────────
      complexity: ["error", { max: 20 }],
      "max-depth": ["error", { max: 3 }],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "no-nested-ternary": "error",

      // ── Type Safety ───────────────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plugin cache and non-source directories
    ".claude/**",
    ".specify/**",
    "specs/**",
    "tests/**",
    "prisma/**",
    "coverage/**",
    "tmp/**",
  ]),
]);

export default eslintConfig;

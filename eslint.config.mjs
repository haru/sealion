import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tsdoc from "eslint-plugin-tsdoc";
import jsdoc from "eslint-plugin-jsdoc";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { tsdoc, jsdoc },
    settings: {
      jsdoc: { mode: "typescript" },
    },
    rules: {
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
  ]),
]);

export default eslintConfig;

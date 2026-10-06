import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // functions/ is its own package: lib/ is built CommonJS output, and src/
    // has its own eslint when needed. Not linted here.
    "functions/**",
    // Runs in the Scriptable app on iPhone, using Scriptable globals
    // (ListWidget, Keychain...). Not Next code.
    "scriptable/**",
  ]),
]);

export default eslintConfig;

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
    // functions/ la package rieng: lib/ la output CommonJS da build, va src/
    // co eslint cua chinh no khi can. Khong lint o day.
    "functions/**",
    // Script chay trong app Scriptable tren iPhone, dung global cua Scriptable
    // (ListWidget, Keychain...). Khong phai code cua Next.
    "scriptable/**",
  ]),
]);

export default eslintConfig;

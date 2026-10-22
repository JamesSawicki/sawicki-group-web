// ESLint flat config: TypeScript, Astro, and TSDoc checks.
// Rules that flag existing code are warnings (to-dos), not errors, so `npm run lint`
// reports debt without blocking work. Formatting is Prettier's job, not ESLint's.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/", ".astro/", "node_modules/"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,

  // React islands (.tsx): rules-of-hooks + exhaustive-deps.
  {
    files: ["src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // TSDoc: exported functions in src/lib must document themselves.
  {
    files: ["src/lib/**/*.ts"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        { publicOnly: true, require: { FunctionDeclaration: true, ArrowFunctionExpression: true } },
      ],
      "jsdoc/check-tag-names": ["warn", { definedTags: ["remarks"] }],
    },
  },

  // Project-wide relaxations: surface as to-dos rather than failures.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
];

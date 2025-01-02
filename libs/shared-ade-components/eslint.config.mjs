import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["!**/*", ".next/**/*", "**/*.config.js"],
}, ...compat.extends(
    "plugin:cypress/recommended",
    "plugin:@nx/react-typescript",
    "next",
    "next/core-web-vitals",
    "../../.eslintrc.json",
), {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],

    rules: {
        "react/forbid-component-props": ["error", {
            forbid: ["style"],
        }],

        "@next/next/no-html-link-for-pages": ["error", "apps/letta/pages"],
        "@typescript-eslint/no-unused-vars": "error",
        "react-hooks/exhaustive-deps": "error",
    },
}, {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {},
}, {
    files: ["**/*.js", "**/*.jsx"],
    rules: {},
}, {
    files: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.spec.js", "**/*.spec.jsx"],

    languageOptions: {
        globals: {
            ...globals.jest,
        },
    },
}, {
    files: ["**/*.cy.{ts,js,tsx,jsx}", "cypress/**/*.{ts,js,tsx,jsx}"],
    rules: {},
}];

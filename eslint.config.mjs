// eslint-config-next ships native flat-config exports as of 16.x, so this
// imports them directly instead of bridging through FlatCompat +
// next/core-web-vitals + next/typescript (the legacy shareable-config
// names). FlatCompat's JSON-schema validator crashes on eslint-plugin-
// react's self-referential `configs.flat` object ("Converting circular
// structure to JSON") when it tries to merge those legacy-style configs —
// a real upstream incompatibility between @eslint/eslintrc and
// eslint-plugin-react 7.37, not anything specific to this project. Using
// the native exports below avoids that code path entirely while producing
// the same rule set.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  // .claude/ is Claude Code's own skill/tooling infrastructure checked into
  // this repo (e.g. .claude/skills/impeccable/scripts/modern-screenshot.umd.js,
  // a vendored third-party UMD bundle) — not part of the Sunday Huddle
  // application, so it's out of scope for this project's lint rules the
  // same way node_modules/.next are.
  {
    ignores: [
      ".claude/**",
      // Supabase Edge Functions run on Deno, not Node — they use jsr:
      // specifiers this project's TypeScript/ESLint resolver can't parse,
      // and every file already opts out of the equivalent Deno lint rule
      // itself (`// deno-lint-ignore-file no-explicit-any`), confirming
      // they're meant to be linted with `deno lint`, not this config.
      "supabase/functions/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;

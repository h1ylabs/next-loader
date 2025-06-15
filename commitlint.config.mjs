import { RuleConfigSeverity } from "@commitlint/types";

/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      [
        /* Conventional Commits */
        "feat",
        "fix",
        "refactor",
        "docs",
        "ci",
        "build",
        "perf",
        "test",

        /* Changesets Release Commit */
        "release",
      ],
    ],
  },
};

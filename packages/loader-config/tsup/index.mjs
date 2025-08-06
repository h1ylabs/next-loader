import { defineConfig } from "tsup";

export default customTsupConfig();

export function customTsupConfig(entries) {
  return defineConfig({
    entry: [
      "src/index.ts",
      ...(entries?.map((entry) => `src/${entry}/index.ts`) ?? []),
    ],
    format: ["cjs", "esm"],
    dts: true,
  });
}

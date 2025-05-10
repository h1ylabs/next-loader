import path from "path";
import fg from "fast-glob";
import fs from "fs/promises";

async function getInternalPackages() {
  const packageJsonPath = path.resolve("package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));

  return fg.glob(packageJson.workspaces ?? [], { onlyDirectories: true, deep: 1 });
}

console.log("[lint-staged] packages detected:", await getInternalPackages());

const internalPackages = await getInternalPackages();
const typeCheckTargetFiles = internalPackages.reduce((accu, internalPackage) => ({
  ...accu,
  [`${internalPackage}/**/*.{ts,tsx}`]: ["yarn check-types"],
}), {});

export default {
  /* Linting */
  "*.{ts,tsx}": ["yarn lint"],

  /* Formatting */
  "*.{ts,tsx,css}": ["yarn format"],

  /* Type Checking */
  ...typeCheckTargetFiles,
};
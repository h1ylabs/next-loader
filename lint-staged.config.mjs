import fg from "fast-glob";
import fs from "fs/promises";
import path from "path";

async function getInternalPackages() {
  const packageJsonPath = path.resolve("package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));

  return await fg.glob(packageJson.workspaces ?? [], {
    onlyDirectories: true,
    deep: 1,
  });
}

async function getPackageNames(packages) {
  const packageNames = {};

  for (const pkg of packages) {
    try {
      const pkgJsonPath = path.join(pkg, "package.json");
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf8"));
      packageNames[pkg] = pkgJson.name || pkg;
    } catch (error) {
      console.error(
        `[lint-staged] Error reading package.json for ${pkg}:`,
        error,
      );
      packageNames[pkg] = pkg;
    }
  }

  return packageNames;
}

async function generateConfig() {
  const internalPackages = await getInternalPackages();
  const packageNames = await getPackageNames(internalPackages);

  console.log("[lint-staged] packages detected:", internalPackages);

  // generate configuration for each package
  const config = {};

  // set rules for files in each package
  for (const internalPackage of internalPackages) {
    const workspaceName = packageNames[internalPackage];

    // linting rules
    config[`${internalPackage}/**/*.{ts,tsx}`] = [
      `yarn workspace ${workspaceName} lint`,
      `yarn workspace ${workspaceName} format:file`,
    ];
  }

  return config;
}

export default await generateConfig();

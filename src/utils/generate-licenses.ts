import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  license?: string | { type?: string };
  licenses?: { type?: string }[] | string[];
}

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(
  fs.readFileSync(packageJsonPath, "utf8"),
) as PackageJson;

const allDependencies: Record<string, string> = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

const licenses: Record<string, string> = {};
const nodeModulesPath = path.join(__dirname, "..", "node_modules");

Object.keys(allDependencies).forEach((pkg) => {
  try {
    const pkgPath = path.join(nodeModulesPath, pkg, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(
        fs.readFileSync(pkgPath, "utf8"),
      ) as PackageJson;
      let license = "Unknown";
      if (pkgJson.license) {
        license =
          typeof pkgJson.license === "string"
            ? pkgJson.license
            : pkgJson.license.type || "Unknown";
      } else if (
        pkgJson.licenses &&
        Array.isArray(pkgJson.licenses) &&
        pkgJson.licenses.length > 0
      ) {
        const first = pkgJson.licenses[0];
        license = typeof first === "string" ? first : first.type || "Unknown";
      }
      licenses[pkg] = license;
    } else {
      licenses[pkg] = "Unknown";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Could not read license for ${pkg}:`, message);
    licenses[pkg] = "Unknown";
  }
});

const outputPath = path.join(__dirname, "licenses.json");
fs.writeFileSync(outputPath, JSON.stringify(licenses, null, 2) + "\n");

console.log(
  `✓ Generated licenses.json with ${Object.keys(licenses).length} packages`,
);
console.log(`  Output: ${outputPath}`);

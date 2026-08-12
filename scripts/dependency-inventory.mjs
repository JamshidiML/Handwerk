import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function writeJson(outputPath, value) {
  const absolute = resolve(root, outputPath);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporary, absolute);
  return absolute;
}

function packageName(path, entry) {
  if (entry.name) return entry.name;
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  return index >= 0 ? path.slice(index + marker.length) : path;
}

function createInventory() {
  const lockText = readFileSync(resolve(root, "package-lock.json"), "utf8");
  const lock = JSON.parse(lockText);
  const packages = Object.entries(lock.packages)
    .filter(([path]) => path !== "")
    .map(([path, entry]) => ({
      path,
      name: packageName(path, entry),
      version: entry.version ?? null,
      developmentOnly: entry.dev === true,
      optional: entry.optional === true,
      workspace: /^(?:apps|packages|tests)\/[^/]+$/.test(path),
      link: entry.link === true,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    schemaVersion: 1,
    source: "package-lock.json",
    sourceSha256: createHash("sha256").update(lockText).digest("hex"),
    lockfileVersion: lock.lockfileVersion,
    packageCount: packages.length,
    packages,
  };
}

const inventoryOutput = argument("--output");
const sbomOutput = argument("--sbom");

if (sbomOutput) {
  const result = spawnSync("npm", ["sbom", "--sbom-format", "cyclonedx"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr.trim() || "npm sbom failed");
    process.exit(result.status ?? 1);
  }
  const output = writeJson(sbomOutput, JSON.parse(result.stdout));
  console.log(`[dependency-inventory] wrote CycloneDX SBOM to ${output}`);
} else {
  const inventory = createInventory();
  if (inventoryOutput) {
    const output = writeJson(inventoryOutput, inventory);
    console.log(
      `[dependency-inventory] wrote ${inventory.packageCount} entries to ${output}`,
    );
  } else {
    console.log(JSON.stringify(inventory, null, 2));
  }
}

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const composeFile = join(root, "infra/local/compose.yml");
const minimumNode = [22, 13, 0];

process.chdir(root);

function fail(message) {
  console.error(`[platform] ${message}`);
  process.exit(1);
}

function parseVersion(version) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function versionAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] === minimum[index]) continue;
    return (actual[index] ?? 0) > (minimum[index] ?? 0);
  }
  return true;
}

function checkRuntime() {
  const actual = parseVersion(process.versions.node);
  if (!versionAtLeast(actual, minimumNode)) {
    fail(
      `Node.js ${minimumNode.join(".")} or newer is required; found ${process.versions.node}.`,
    );
  }
}

function loadEnvironment() {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

function initializeEnvironment() {
  if (existsSync(envPath)) {
    console.log("[platform] .env already exists; leaving it unchanged.");
    return;
  }
  copyFileSync(join(root, ".env.example"), envPath);
  console.log(
    "[platform] Created .env from the local synthetic-data template.",
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    fail(`${command} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function workspaceHasScript(scriptName) {
  for (const parent of ["apps", "packages", "tests"]) {
    const parentPath = join(root, parent);
    if (!existsSync(parentPath)) continue;
    for (const child of readdirSync(parentPath, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const manifestPath = join(parentPath, child.name, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.scripts?.[scriptName]) return true;
    }
  }
  return false;
}

function compose(args) {
  if (!existsSync(envPath)) {
    fail(".env is missing. Run npm run env:init first.");
  }
  loadEnvironment();
  run("docker", ["compose", "--env-file", envPath, "-f", composeFile, ...args]);
}

const [command, ...args] = process.argv.slice(2);
checkRuntime();

switch (command) {
  case "setup":
    initializeEnvironment();
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
    run("npm", ["run", "env:check"]);
    console.log(
      "[platform] Local setup complete. Start dependencies with npm run services:up.",
    );
    break;
  case "env-init":
    initializeEnvironment();
    break;
  case "services-up":
    compose(["up", "-d", "--wait"]);
    break;
  case "services-down":
    compose(["down"]);
    break;
  case "services-status":
    compose(["ps"]);
    break;
  case "migration-check":
    loadEnvironment();
    if (!workspaceHasScript("db:migrate")) {
      console.log(
        "[platform] No db:migrate workspace is integrated; migration check is not applicable yet.",
      );
      break;
    }
    run("npm", ["run", "db:migrate", "--workspaces", "--if-present"]);
    run("npm", ["run", "db:migrate", "--workspaces", "--if-present"]);
    console.log("[platform] Migrations applied twice without error.");
    break;
  case "npm":
    loadEnvironment();
    run("npm", args);
    break;
  default:
    fail(`Unknown command: ${command ?? "<none>"}`);
}

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateAudit } from "./lib/audit-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const policy = JSON.parse(
  readFileSync(
    resolve(root, "scripts/config/dependency-audit-policy.json"),
    "utf8",
  ),
);
const result = spawnSync("npm", ["audit", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("[dependency-audit] npm audit did not return valid JSON.");
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

const evaluation = evaluateAudit(report, policy);
for (const exception of evaluation.accepted) {
  console.warn(
    `[dependency-audit] temporary ${exception.severity} exception: ${exception.package}; owner=${exception.owner}; expires=${exception.expiresOn}`,
  );
}
for (const failure of evaluation.failures) {
  console.error(`[dependency-audit] ${failure.package}: ${failure.reason}`);
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `[dependency-audit] findings critical=${counts.critical ?? 0} high=${counts.high ?? 0} moderate=${counts.moderate ?? 0} low=${counts.low ?? 0}`,
);
if (evaluation.failures.length > 0) process.exit(1);

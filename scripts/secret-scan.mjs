import { resolve } from "node:path";
import { scanFiles, trackedAndUntrackedFiles } from "./lib/secret-scan.mjs";

const root = resolve(import.meta.dirname, "..");
const files = trackedAndUntrackedFiles(root);
const findings = scanFiles(root, files);

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line}:${finding.column} ${finding.rule}`,
    );
  }
  console.error(`[secret-scan] ${findings.length} potential secret(s) found.`);
  process.exit(1);
}

console.log(
  `[secret-scan] scanned ${files.length} files; no potential secrets found.`,
);

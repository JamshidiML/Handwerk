import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const secretPatterns = [
  [
    "private-key",
    new RegExp(
      ["-----BEGIN ", "(?:EC |OPENSSH |RSA )?", "PRIVATE KEY-----"].join(""),
      "g",
    ),
  ],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  [
    "github-token",
    /\b(?:gh[opsu]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g,
  ],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["google-api-key", /\bAIza[A-Za-z0-9_-]{30,}\b/g],
  ["stripe-live-key", /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g],
];

const genericAssignment =
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{12,})/gi;
const allowedPlaceholder =
  /(?:change-me|development-only|example|placeholder|synthetic|test-only)/i;

function locationFor(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function scanText(text) {
  const findings = [];
  for (const [rule, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({ rule, ...locationFor(text, match.index ?? 0) });
    }
  }

  genericAssignment.lastIndex = 0;
  for (const match of text.matchAll(genericAssignment)) {
    const candidate = match[1] ?? "";
    if (!allowedPlaceholder.test(candidate)) {
      findings.push({
        rule: "credential-assignment",
        ...locationFor(text, match.index ?? 0),
      });
    }
  }
  return findings;
}

export function trackedAndUntrackedFiles(cwd) {
  const output = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    {
      cwd,
      encoding: "utf8",
    },
  );
  return output.split("\0").filter(Boolean).sort();
}

export function scanFiles(cwd, files) {
  const findings = [];
  for (const file of files) {
    const bytes = readFileSync(`${cwd}/${file}`);
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    for (const finding of scanText(text)) {
      findings.push({ file, ...finding });
    }
  }
  return findings;
}

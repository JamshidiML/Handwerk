import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
);
const webManifest = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../apps/web/package.json"),
    "utf8",
  ),
);
const lockfile = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package-lock.json"), "utf8"),
);
const workflow = readFileSync(
  resolve(import.meta.dirname, "../../.github/workflows/ci.yml"),
  "utf8",
);
const databaseIntegrationTest = readFileSync(
  resolve(
    import.meta.dirname,
    "../../packages/db/tests/integration/postgres.integration.test.ts",
  ),
  "utf8",
);

describe("root test command", () => {
  it("builds before running workspace tests", () => {
    const command = manifest.scripts.test;
    expect(command).toContain("npm run build");
    expect(command.indexOf("npm run build")).toBeLessThan(
      command.indexOf("--workspaces"),
    );
    expect(command).not.toContain("--parallel");
    expect(workflow).toMatch(/Fresh-worktree build and test\n\s+run: npm test/);
  });
});

describe("cross-platform CI contracts", () => {
  it("locks the Tailwind and Lightning CSS Linux glibc bindings", () => {
    expect(webManifest.optionalDependencies).toEqual({
      "@tailwindcss/oxide-linux-x64-gnu": "4.2.1",
    });
    expect(
      lockfile.packages["node_modules/@tailwindcss/oxide-linux-x64-gnu"],
    ).toMatchObject({
      version: "4.2.1",
      cpu: ["x64"],
      libc: ["glibc"],
      optional: true,
      os: ["linux"],
    });
    expect(
      lockfile.packages["apps/web/node_modules/lightningcss-linux-x64-gnu"],
    ).toMatchObject({
      version: "1.31.1",
      cpu: ["x64"],
      libc: ["glibc"],
      optional: true,
      os: ["linux"],
    });
  });

  it("uploads exactly the two generated dependency evidence files", () => {
    const artifactStep = workflow.slice(
      workflow.indexOf("- uses: actions/upload-artifact@v4"),
    );

    expect(artifactStep).toMatch(/name: dependency-evidence/);
    expect(artifactStep).toMatch(
      /path: \|\n\s+\.artifacts\/dependency-inventory\.json\n\s+\.artifacts\/sbom\.cdx\.json/,
    );
    expect(artifactStep).toMatch(/include-hidden-files: true/);
    expect(artifactStep).toMatch(/if-no-files-found: error/);
    expect(artifactStep).toMatch(/retention-days: 14/);
    expect(artifactStep).not.toMatch(/path: \.artifacts\/\s*$/m);
  });

  it("requires the PostgreSQL job to execute the integration suite", () => {
    const globalEnvironment = workflow.slice(
      workflow.indexOf("env:"),
      workflow.indexOf("jobs:"),
    );
    const integrationJob = workflow.slice(
      workflow.indexOf("  integration:"),
      workflow.indexOf("  e2e:"),
    );

    expect(globalEnvironment).not.toContain("HANDWERK_TEST_DATABASE_URL");
    expect(integrationJob).toMatch(
      /HANDWERK_TEST_DATABASE_URL: postgresql:\/\/handwerk_test:synthetic-ci-only-change-me@127\.0\.0\.1:5432\/handwerk_t01_test/,
    );
    expect(integrationJob).toMatch(/HANDWERK_REQUIRE_DB_INTEGRATION: "true"/);
    expect(integrationJob).toMatch(/POSTGRES_DB: handwerk_t01_test/);
    expect(integrationJob).toMatch(
      /pg_isready -U handwerk_test -d handwerk_t01_test/,
    );
    expect(databaseIntegrationTest).toContain(
      'process.env.HANDWERK_REQUIRE_DB_INTEGRATION === "true"',
    );
  });
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const fixtureRoot = fileURLToPath(
  new URL("../../../fixtures/synthetic/", import.meta.url),
);

export function fixturePath(relativePath: string): string {
  return resolve(fixtureRoot, relativePath);
}

export function readFixture<T>(relativePath: string): T {
  return JSON.parse(readFileSync(fixturePath(relativePath), "utf8")) as T;
}

export function readFixtureBytes(relativePath: string): Buffer {
  return readFileSync(fixturePath(relativePath));
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

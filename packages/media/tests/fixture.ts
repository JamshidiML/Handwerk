import { readFile } from "node:fs/promises";

export async function fixtureBytes(filename: string): Promise<Uint8Array> {
  const encoded = await readFile(
    new URL(`../fixtures/${filename}`, import.meta.url),
    "utf8",
  );
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

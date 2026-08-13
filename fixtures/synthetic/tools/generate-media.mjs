import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mediaDir = resolve(fixtureRoot, "media");
mkdirSync(mediaDir, { recursive: true });

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const glyphs = {
  "-": [0, 0, 31, 0, 0, 0, 0],
  A: [14, 17, 17, 31, 17, 17, 17],
  C: [14, 17, 16, 16, 16, 17, 14],
  E: [31, 16, 16, 30, 16, 16, 31],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  Y: [17, 17, 10, 4, 4, 4, 4],
};

function createSyntheticPng() {
  const width = 640;
  const height = 360;
  const pixels = Buffer.alloc(width * height * 4);

  function setPixel(x, y, red, green, blue, alpha = 255) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    pixels[offset] = red;
    pixels[offset + 1] = green;
    pixels[offset + 2] = blue;
    pixels[offset + 3] = alpha;
  }

  function rectangle(x, y, rectangleWidth, rectangleHeight, colour) {
    for (let row = y; row < y + rectangleHeight; row += 1) {
      for (let column = x; column < x + rectangleWidth; column += 1) {
        setPixel(column, row, ...colour);
      }
    }
  }

  function text(value, x, y, scale, colour) {
    let cursor = x;
    for (const character of value) {
      if (character === " ") {
        cursor += 6 * scale;
        continue;
      }
      const rows = glyphs[character] ?? glyphs.E;
      rows.forEach((row, rowIndex) => {
        for (let column = 0; column < 5; column += 1) {
          if ((row & (1 << (4 - column))) === 0) continue;
          rectangle(
            cursor + column * scale,
            y + rowIndex * scale,
            scale,
            scale,
            colour,
          );
        }
      });
      cursor += 6 * scale;
    }
  }

  rectangle(0, 0, width, height, [239, 244, 241]);
  rectangle(0, 240, width, 120, [88, 102, 94]);
  rectangle(54, 92, 532, 148, [214, 221, 215]);
  rectangle(80, 125, 92, 115, [61, 79, 70]);
  rectangle(468, 122, 74, 118, [61, 79, 70]);
  rectangle(88, 133, 76, 107, [191, 214, 231]);
  rectangle(476, 130, 58, 110, [191, 214, 231]);
  rectangle(0, 0, width, 72, [166, 35, 45]);
  text("SYNTHETIC TEST IMAGE", 22, 14, 4, [255, 255, 255]);
  text("NOT A REAL SITE", 195, 304, 4, [255, 255, 255]);

  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function createSyntheticWav() {
  const sampleRate = 16_000;
  const durationSeconds = 2;
  const sampleCount = sampleRate * durationSeconds;
  const data = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const secondHalf = index >= sampleRate;
    const frequency = secondHalf ? 660 : 440;
    const envelope = Math.min(1, index / 800, (sampleCount - index) / 800);
    const sample = Math.round(
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) *
        0.18 *
        envelope *
        32767,
    );
    data.writeInt16LE(sample, index * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function describe(filename, mediaType, bytes, semantics) {
  return {
    filename,
    mediaType,
    sizeBytes: bytes.length,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    synthetic: true,
    semantics,
  };
}

const png = createSyntheticPng();
const wav = createSyntheticWav();
writeFileSync(resolve(mediaDir, "synthetic-living-room.png"), png);
writeFileSync(resolve(mediaDir, "synthetic-site-note.wav"), wav);
writeFileSync(
  resolve(mediaDir, "media-manifest.json"),
  `${JSON.stringify(
    {
      fixtureSetId: "handwerk-synthetic-v1",
      synthetic: true,
      generatedBy: "fixtures/synthetic/tools/generate-media.mjs",
      files: [
        describe(
          "synthetic-living-room.png",
          "image/png",
          png,
          "Geometric room test image with an embedded SYNTHETIC TEST IMAGE watermark.",
        ),
        describe(
          "synthetic-site-note.wav",
          "audio/wav",
          wav,
          "Synthetic generated two-tone PCM audio; contains no human speech or biometric data.",
        ),
      ],
    },
    null,
    2,
  )}\n`,
);

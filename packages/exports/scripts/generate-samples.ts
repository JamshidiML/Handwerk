import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createSyntheticApprovedExportInput } from "../fixtures/synthetic-offer";
import {
  ApprovedOfferExportService,
  InMemoryExportArtifactStore,
} from "../src";

const outputDirectory = new URL("../fixtures/generated/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const input = createSyntheticApprovedExportInput({
  lineCount: 10,
  longDescriptions: true,
});
const store = new InMemoryExportArtifactStore();
const result = await new ApprovedOfferExportService(store).create(input);
const artifacts = await store.listByDraft(input.draft.id);

await Promise.all([
  writeFile(
    new URL(result.pdf.artifact.filename, outputDirectory),
    result.pdf.bytes,
  ),
  writeFile(
    new URL(result.csv.artifact.filename, outputDirectory),
    result.csv.bytes,
  ),
  writeFile(
    new URL("export-metadata.json", outputDirectory),
    `${JSON.stringify(
      {
        synthetic: true,
        offerNumber: input.offerNumber,
        revision: input.revision.revision,
        totalsMinor: {
          net: input.revision.netTotal.minor,
          tax: input.revision.taxTotal.minor,
          gross: input.revision.grossTotal.minor,
        },
        artifacts,
      },
      null,
      2,
    )}\n`,
    "utf8",
  ),
]);

process.stdout.write(
  `Synthetic samples written to ${fileURLToPath(outputDirectory)}\n`,
);

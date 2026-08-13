import type { ExtractionEvidence } from "../src/index.js";

export function canonicalEvidence(
  fixtureId = "canonical-westblick",
  transcriptText = "Die Wände zweimal weiß, zwei Türzargen schützen; Decke und Untergrund noch klären.",
): ExtractionEvidence {
  return {
    fixtureId,
    evidenceRevision: "synthetic-revision-1",
    transcriptSegments: [
      {
        sourceEntityId: "transcript-segment-001",
        startMs: 0,
        endMs: 4500,
        language: "de",
        text: transcriptText,
      },
    ],
    explicitMeasurements: [
      {
        sourceEntityId: "measurement-wall-area-52",
        label: "Wandfläche",
        context: "Wohnzimmer",
        value: "52",
        unit: "M2",
        confirmedByUser: true,
      },
      {
        sourceEntityId: "measurement-ceiling-area-20",
        label: "Deckenfläche",
        context: "Wohnzimmer",
        value: "20",
        unit: "M2",
        confirmedByUser: true,
      },
    ],
    photoContext: [
      {
        sourceEntityId: "photo-synthetic-living-room-001",
        description: "Synthetischer Innenraum ohne Maßstab.",
        authority: "CONTEXT_ONLY",
      },
    ],
  };
}

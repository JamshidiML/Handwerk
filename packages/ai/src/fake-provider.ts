import { CONTRACT_VERSION } from "@handwerk/contracts";

import type { ExtractionResult } from "./schema.js";
import type {
  AiProviderBundle,
  NormalisationProvider,
  NormalisationRequest,
  NormalisationResult,
  ProviderDescriptor,
  StructuredExtractionProvider,
  StructuredExtractionProviderRequest,
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
  VisualContextProvider,
  VisualContextRequest,
  VisualContextResult,
} from "./types.js";

const descriptor: ProviderDescriptor = {
  kind: "DETERMINISTIC_FAKE",
  name: "handwerk-deterministic-fake",
  model: "canonical-westblick-v1",
};

export const CANONICAL_EXTRACTION_RESULT: ExtractionResult = {
  contractVersion: CONTRACT_VERSION,
  facts: [
    {
      key: "wall.area",
      value: 52,
      unit: "M2",
      status: "CONFIRMED",
      sourceLocators: [
        {
          sourceType: "EXPLICIT_MEASUREMENT",
          sourceEntityId: "measurement-wall-area-52",
          locator: "measurement:measurement-wall-area-52",
          authority: "AUTHORITATIVE",
        },
      ],
    },
    {
      key: "wall.coats",
      value: 2,
      status: "CONFIRMED",
      sourceLocators: [
        {
          sourceType: "TRANSCRIPT_SEGMENT",
          sourceEntityId: "transcript-segment-001",
          locator: "time:0-4500ms",
          authority: "AUTHORITATIVE",
        },
      ],
    },
    {
      key: "ceiling.area",
      value: 20,
      unit: "M2",
      status: "CONFIRMED",
      sourceLocators: [
        {
          sourceType: "EXPLICIT_MEASUREMENT",
          sourceEntityId: "measurement-ceiling-area-20",
          locator: "measurement:measurement-ceiling-area-20",
          authority: "AUTHORITATIVE",
        },
      ],
    },
    {
      key: "door_frames.protection_count",
      value: 2,
      unit: "STK",
      status: "CONFIRMED",
      sourceLocators: [
        {
          sourceType: "TRANSCRIPT_SEGMENT",
          sourceEntityId: "transcript-segment-002",
          locator: "time:4500-8000ms",
          authority: "AUTHORITATIVE",
        },
      ],
    },
    {
      key: "substrate.condition",
      value: null,
      status: "UNKNOWN",
      sourceLocators: [
        {
          sourceType: "TRANSCRIPT_SEGMENT",
          sourceEntityId: "transcript-segment-003",
          locator: "time:8000-10500ms",
          authority: "AUTHORITATIVE",
        },
      ],
    },
  ],
  missingFields: ["ceiling.included", "substrate.condition"],
};

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new DOMException("The operation was cancelled", "AbortError");
  }
};

export class DeterministicFakeAiProvider
  implements
    StructuredExtractionProvider,
    TranscriptionProvider,
    VisualContextProvider,
    NormalisationProvider
{
  readonly descriptor = descriptor;

  async transcribe(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResult> {
    throwIfAborted(request.signal);

    if (request.transcriptFallback !== undefined) {
      return {
        language: "de",
        segments: [
          {
            sourceEntityId: "transcript-fallback-001",
            startMs: 0,
            endMs: 0,
            text: request.transcriptFallback,
            language: "de",
          },
        ],
        usedFallback: true,
      };
    }

    return {
      language: "de",
      segments: [
        {
          sourceEntityId: "transcript-segment-001",
          startMs: 0,
          endMs: 4500,
          text: "Die Wände erhalten zwei weiße Anstriche.",
          language: "de",
        },
        {
          sourceEntityId: "transcript-segment-002",
          startMs: 4500,
          endMs: 8000,
          text: "Zwei Türzargen müssen geschützt werden.",
          language: "de",
        },
        {
          sourceEntityId: "transcript-segment-003",
          startMs: 8000,
          endMs: 10500,
          text: "Untergrundzustand und Deckenumfang sind noch zu klären.",
          language: "de",
        },
      ],
      usedFallback: false,
    };
  }

  async describeVisualContext(
    request: VisualContextRequest,
  ): Promise<VisualContextResult> {
    throwIfAborted(request.signal);

    return {
      observations: request.photos.map((photo) => ({
        sourceEntityId: photo.sourceEntityId,
        description:
          "Synthetisches Foto eines Innenraums; nur als sichtbarer Kontext verwendbar.",
        authority: "CONTEXT_ONLY",
      })),
    };
  }

  async normalise(request: NormalisationRequest): Promise<NormalisationResult> {
    throwIfAborted(request.signal);

    return {
      sourceLanguage: request.sourceLanguage,
      targetLocale: request.targetLocale,
      text: request.text.replace(/\s+/g, " ").trim(),
    };
  }

  async extract(
    request: StructuredExtractionProviderRequest,
  ): Promise<unknown> {
    throwIfAborted(request.signal);
    return structuredClone(CANONICAL_EXTRACTION_RESULT);
  }
}

export function createDeterministicFakeProvider(): AiProviderBundle {
  const provider = new DeterministicFakeAiProvider();
  return {
    transcription: provider,
    visualContext: provider,
    normalisation: provider,
    extraction: provider,
  };
}

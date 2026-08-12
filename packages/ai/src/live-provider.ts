import type {
  AiProviderBundle,
  NormalisationProvider,
  ProviderDescriptor,
  StructuredExtractionProvider,
  TranscriptionProvider,
  VisualContextProvider,
} from "./types.js";

export const LIVE_AI_ENABLED_BY_DEFAULT = false as const;

export interface LiveProviderTransports {
  transcription: Pick<TranscriptionProvider, "transcribe">;
  visualContext: Pick<VisualContextProvider, "describeVisualContext">;
  normalisation: Pick<NormalisationProvider, "normalise">;
  extraction: Pick<StructuredExtractionProvider, "extract">;
}

export interface LiveProviderOptions {
  enabled?: boolean;
  name: string;
  model: string;
  transports: LiveProviderTransports;
}

export class LiveProviderDisabledError extends Error {
  constructor() {
    super("Live AI provider is disabled; enable it explicitly outside CI/demo");
    this.name = "LiveProviderDisabledError";
  }
}

export function createFlaggedLiveProvider(
  options: LiveProviderOptions,
): AiProviderBundle {
  if (options.enabled !== true) {
    throw new LiveProviderDisabledError();
  }

  const descriptor: ProviderDescriptor = {
    kind: "LIVE_FLAGGED",
    name: options.name,
    model: options.model,
  };

  return {
    transcription: {
      descriptor,
      transcribe: (request) =>
        options.transports.transcription.transcribe(request),
    },
    visualContext: {
      descriptor,
      describeVisualContext: (request) =>
        options.transports.visualContext.describeVisualContext(request),
    },
    normalisation: {
      descriptor,
      normalise: (request) =>
        options.transports.normalisation.normalise(request),
    },
    extraction: {
      descriptor,
      extract: (request) => options.transports.extraction.extract(request),
    },
  };
}

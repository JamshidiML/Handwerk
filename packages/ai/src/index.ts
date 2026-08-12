export {
  CANONICAL_EXTRACTION_RESULT,
  DeterministicFakeAiProvider,
  createDeterministicFakeProvider,
} from "./fake-provider.js";
export {
  StructuredExtractionRunner,
  type ExtractionExecutionFailure,
  type ExtractionExecutionResult,
  type ExtractionExecutionSuccess,
  type ExtractionFailureCode,
  type ExtractionRunMetadata,
  type ExtractionRunRequest,
  type ExtractionRunnerOptions,
} from "./extraction-runner.js";
export {
  LIVE_AI_ENABLED_BY_DEFAULT,
  LiveProviderDisabledError,
  createFlaggedLiveProvider,
  type LiveProviderOptions,
  type LiveProviderTransports,
} from "./live-provider.js";
export {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_INSTRUCTION,
  buildUntrustedDataEnvelope,
} from "./prompt.js";
export {
  ReplayExtractionProvider,
  parseReplayFixture,
  replayFixtureSchema,
  type ReplayFixture,
} from "./replay-provider.js";
export {
  ExtractionValidationError,
  extractedFactSchema,
  extractionResultSchema,
  parseExtractionResult,
  sourceLocatorSchema,
  type ExtractedFactResult,
  type ExtractionResult,
  type SanitisedValidationIssue,
  type SourceLocatorResult,
} from "./schema.js";
export {
  ProviderCallError,
  type AiProviderBundle,
  type AudioReference,
  type ExplicitMeasurementInput,
  type ExtractionEvidence,
  type LengthDelimitedDataEnvelope,
  type NormalisationProvider,
  type NormalisationRequest,
  type NormalisationResult,
  type PhotoContextInput,
  type PhotoReference,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderKind,
  type StructuredExtractionProvider,
  type StructuredExtractionProviderRequest,
  type TranscriptionProvider,
  type TranscriptionRequest,
  type TranscriptionResult,
  type TranscriptionSegmentDraft,
  type UntrustedTranscriptSegment,
  type VisualContextProvider,
  type VisualContextRequest,
  type VisualContextResult,
  type VisualObservation,
} from "./types.js";

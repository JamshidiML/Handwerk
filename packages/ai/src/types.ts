import type { Unit } from "@handwerk/contracts";

export type ProviderKind = "DETERMINISTIC_FAKE" | "LIVE_FLAGGED";

export interface ProviderDescriptor {
  kind: ProviderKind;
  name: string;
  model: string;
}

export interface ProviderCallContext {
  idempotencyKey: string;
  signal: AbortSignal;
}

export interface AudioReference {
  assetId: string;
  mediaType: string;
  sizeBytes: number;
  synthetic: true;
}

export interface TranscriptionRequest extends ProviderCallContext {
  fixtureId?: string;
  audio: AudioReference;
  transcriptFallback?: string;
}

export interface TranscriptionSegmentDraft {
  sourceEntityId: string;
  startMs: number;
  endMs: number;
  text: string;
  language: string;
}

export interface TranscriptionResult {
  language: string;
  segments: TranscriptionSegmentDraft[];
  usedFallback: boolean;
}

export interface TranscriptionProvider {
  readonly descriptor: ProviderDescriptor;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export interface PhotoReference {
  sourceEntityId: string;
  mediaType: string;
  synthetic: true;
}

export interface VisualContextRequest extends ProviderCallContext {
  fixtureId?: string;
  photos: PhotoReference[];
}

export interface VisualObservation {
  sourceEntityId: string;
  description: string;
  authority: "CONTEXT_ONLY";
}

export interface VisualContextResult {
  observations: VisualObservation[];
}

export interface VisualContextProvider {
  readonly descriptor: ProviderDescriptor;
  describeVisualContext(
    request: VisualContextRequest,
  ): Promise<VisualContextResult>;
}

export interface NormalisationRequest extends ProviderCallContext {
  fixtureId?: string;
  sourceLanguage: string;
  targetLocale: "de-DE";
  text: string;
}

export interface NormalisationResult {
  sourceLanguage: string;
  targetLocale: "de-DE";
  text: string;
}

export interface NormalisationProvider {
  readonly descriptor: ProviderDescriptor;
  normalise(request: NormalisationRequest): Promise<NormalisationResult>;
}

export interface UntrustedTranscriptSegment {
  sourceEntityId: string;
  startMs: number;
  endMs: number;
  language: string;
  text: string;
}

export interface ExplicitMeasurementInput {
  sourceEntityId: string;
  label: string;
  context: string;
  value: string;
  unit: Unit;
  confirmedByUser: true;
}

export interface PhotoContextInput {
  sourceEntityId: string;
  description: string;
  authority: "CONTEXT_ONLY";
}

export interface ExtractionEvidence {
  fixtureId?: string;
  evidenceRevision: string;
  transcriptSegments: UntrustedTranscriptSegment[];
  explicitMeasurements: ExplicitMeasurementInput[];
  photoContext: PhotoContextInput[];
}

export interface LengthDelimitedDataEnvelope {
  format: "handwerk.untrusted-evidence.v1";
  byteLength: number;
  payload: string;
  wire: string;
}

export interface StructuredExtractionProviderRequest
  extends ProviderCallContext {
  fixtureId?: string;
  systemInstruction: string;
  dataEnvelope: LengthDelimitedDataEnvelope;
}

export interface StructuredExtractionProvider {
  readonly descriptor: ProviderDescriptor;
  extract(request: StructuredExtractionProviderRequest): Promise<unknown>;
}

export interface AiProviderBundle {
  transcription: TranscriptionProvider;
  visualContext: VisualContextProvider;
  normalisation: NormalisationProvider;
  extraction: StructuredExtractionProvider;
}

export class ProviderCallError extends Error {
  readonly retryable: boolean;

  constructor(options: { retryable: boolean; cause?: unknown }) {
    super("AI provider call failed", { cause: options.cause });
    this.name = "ProviderCallError";
    this.retryable = options.retryable;
  }
}

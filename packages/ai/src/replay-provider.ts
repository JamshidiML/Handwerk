import { z } from "zod";

import {
  ProviderCallError,
  type ProviderDescriptor,
  type StructuredExtractionProvider,
  type StructuredExtractionProviderRequest,
} from "./types.js";

const replayOutputSchema = z.union([
  z.string(),
  z.record(z.unknown()),
  z.array(z.unknown()),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const replayFixtureSchema = z
  .object({
    fixtureVersion: z.literal("handwerk.ai-replay.v1"),
    synthetic: z.literal(true),
    fixtureId: z.string().min(1),
    request: z
      .object({
        evidenceRevision: z.string().min(1),
        transcriptText: z.string().optional(),
      })
      .strict()
      .optional(),
    response: z.discriminatedUnion("kind", [
      z
        .object({ kind: z.literal("OUTPUT"), body: replayOutputSchema })
        .strict(),
      z
        .object({
          kind: z.literal("ERROR"),
          retryable: z.boolean(),
        })
        .strict(),
      z.object({ kind: z.literal("TIMEOUT") }).strict(),
    ]),
  })
  .strict();

export type ReplayFixture = z.infer<typeof replayFixtureSchema>;

export function parseReplayFixture(raw: unknown): ReplayFixture {
  return replayFixtureSchema.parse(raw);
}

export class ReplayExtractionProvider implements StructuredExtractionProvider {
  readonly descriptor: ProviderDescriptor = {
    kind: "DETERMINISTIC_FAKE",
    name: "handwerk-synthetic-replay",
    model: "replay-v1",
  };

  constructor(private readonly fixture: ReplayFixture) {}

  async extract(
    request: StructuredExtractionProviderRequest,
  ): Promise<unknown> {
    if (request.fixtureId !== this.fixture.fixtureId) {
      throw new ProviderCallError({ retryable: false });
    }

    switch (this.fixture.response.kind) {
      case "OUTPUT":
        return structuredClone(this.fixture.response.body);
      case "ERROR":
        throw new ProviderCallError({
          retryable: this.fixture.response.retryable,
        });
      case "TIMEOUT":
        return new Promise<never>((_resolve, reject) => {
          const onAbort = (): void => {
            reject(
              new DOMException("The operation was cancelled", "AbortError"),
            );
          };
          if (request.signal.aborted) {
            onAbort();
            return;
          }
          request.signal.addEventListener("abort", onAbort, { once: true });
        });
    }
  }
}

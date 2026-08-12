# `@handwerk/ai`

Provider-neutral AI boundary for the synthetic Handwerk vertical slice. The
package exposes transcription, visual-context, German normalisation, and
structured extraction interfaces. `createDeterministicFakeProvider()` is the
default for local demos and tests and performs no network calls.

## Safety boundary

- Structured output is parsed by strict Zod schemas compatible with
  `handwerk.vertical-slice.v1`; unknown keys and malformed JSON fail closed.
- Prices, price-book IDs, item codes, and approval decisions are absent from the
  schema and therefore rejected wherever a provider attempts to add them.
- Every fact requires a source locator. Unit-bearing facts require at least one
  non-photo authoritative source. Photo context is always `CONTEXT_ONLY`.
- Contradictory facts keep a `null` value and require two distinct citations.
- Untrusted evidence is kept outside the system instruction in a UTF-8
  byte-length-prefixed JSON envelope. Live transports must preserve those roles.
- Execution metadata contains provider/version/timing/outcome fields and zeroed
  token/cost placeholders, never transcript text, media, prompts, or raw output.

## Live provider integration

Live transport code belongs in an adapter that implements `LiveProviderTransports`.
Construct it only through `createFlaggedLiveProvider({ enabled: true, ... })` after
configuration is validated at the application boundary. The default is disabled;
CI and the canonical demo must continue to use deterministic or replay providers.
Load credentials from the runtime secret mechanism outside this package. Never put
keys, signed media URLs, or provider payloads in configuration committed to Git.

The runner enforces a 60-second maximum per-attempt timeout, at most three attempts,
abort propagation, bounded exponential delay, successful-result idempotency, and
`FAILED_SAFE` terminal results. Callers must advance `evidenceRevision` whenever
content changes before reusing an idempotency key.

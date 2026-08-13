# Handwerk Quote Copilot V1 Demo Script

## Boundaries

This is a five-to-ten-minute internal demonstration using the committed `handwerk-synthetic-v1` fixture set only. It is not a production demo, a customer offer, a statement of legal/tax compliance, or evidence of real construction work. Do not connect a live AI provider, a production endpoint, or real customer information.

## Before The Demo

1. Start the local integrated application with its test-only E2E adapter enabled. The adapter must reject startup outside `NODE_ENV=test`, reject production mode, and require a local non-secret test token.
2. Seed `canonical-capture` through the adapter. Confirm the response identifies `handwerk-synthetic-v1`.
3. Use a mobile viewport first, then repeat the review/export section at desktop width.
4. Keep browser downloads, screenshots, test reports, and generated output outside version control unless they were generated from this fixture pack and reviewed.

## Walkthrough

1. Open `/demo` and identify the synthetic organisation `Malerbetrieb Westblick GmbH`.
2. Select the synthetic customer `Beispielkundin 01` and `Wohnzimmer renovieren - Bochum`. Point out the synthetic-data labelling.
3. Start the site-visit capture. Upload the generated tone WAV and the watermarked synthetic PNG. If microphone access is unavailable, use the explicitly labelled transcript fallback.
4. Enter the explicit measurements: `52 m²` of wall area and `20 m²` of ceiling area. State that the photo is context-only and is not a measurement source.
5. Start the deterministic extraction. Review the transcript-derived two wall coats and two door frames, then show the unresolved ceiling inclusion and substrate condition.
6. Answer `Nein` to `Soll die Decke mitgestrichen werden?` and `Ja` to the substrate question. Update the draft.
7. Review the two permitted positions: `MAL-WAND-2X` and `SCH-TUER-RAHMEN`. Confirm that `MAL-DECKE-2X` is excluded and that every line has a calculation, tax treatment, source references, risk state, and human origin.
8. Make one controlled description edit. Verify that the current revision requires human confirmation before approval.
9. Check the explicit review acknowledgement and approve the current revision. Only now export the branded synthetic PDF and CSV.
10. Show the audit trail for capture, extraction, mapping, clarification, edit, approval, and export. Demonstrate the project-data export and the clearly confirmed demo-deletion flow.

## Failure And Safety Stops

Use these short checks when time permits. They demonstrate that uncertainty and unsafe data are surfaced rather than silently accepted.

| Scenario                                    | Expected result                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Denied microphone                           | A transcript fallback is available; capture can continue without raw microphone access. |
| Upload fault                                | A recoverable error appears; retry does not create duplicate/partial metadata.          |
| Invalid model output                        | Processing fails safely and creates no priced line.                                     |
| Unknown mapping                             | The item stays unpriced and approval remains blocked.                                   |
| Photo-only area                             | The image remains context-only; it cannot create an authoritative measurement.          |
| Hallucinated code or prompt-like transcript | No invented price code, price, or autonomous action occurs.                             |
| Commercial edit after approval              | The approval is invalidated and exports are blocked until reapproval.                   |
| Cross-tenant project ID                     | The response is a neutral not-found result with no tenant details.                      |

## Demo Evidence To Capture After Integration

- mobile and desktop canonical journey screenshots;
- a rendered synthetic PDF inspected for readability;
- a parsed CSV reconciled against `793,73 EUR` gross total;
- the Playwright report, accessibility result, and redacted local logs;
- the E2E trace with no external AI/network dependency.

Do not describe the slice as production-ready until these integration-evidence artifacts exist and the release gate passes.

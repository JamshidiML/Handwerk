# Synthetic Fixture Pack V1

Every file in this directory is fabricated for the Handwerk Quote Copilot internal vertical slice. Names, identifiers, project details, media, transcript content, measurements, prices, and outputs are synthetic and must never be presented as customer evidence.

The canonical display names are explicitly synthetic, including `Malerbetrieb Westblick GmbH`, `Beispielkundin 01`, and `Wohnzimmer renovieren - Bochum`. No street address, contact detail, account credential, real site media, or confidential price book is present.

## Layout

- `identity/`: organisation, demo user, customer, and project records.
- `capture/`: transcript and authoritative explicit measurements plus media metadata.
- `media/`: deterministic generated WAV and PNG assets with hashes.
- `pricebook/`: approved same-tenant entries and precise prices in EUR minor units.
- `extraction/`: expected facts and fail-closed adversarial model cases.
- `clarifications/`: canonical blocking questions and deterministic answers.
- `draft/`: an approved revision whose lines all resolve to the price book.
- `exports/`: CSV/PDF/project-data expectations and a golden CSV.
- `security/`: cross-tenant and spreadsheet-formula payloads.

Run `node fixtures/synthetic/tools/generate-media.mjs` to regenerate the binary media exactly. The audio is a generated tone sequence, not a recording of a person; the deterministic fake provider associates it with the synthetic transcript. The PNG contains an on-image synthetic watermark and depicts only geometric test shapes.

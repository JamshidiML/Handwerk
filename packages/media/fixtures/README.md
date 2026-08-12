# Synthetic media fixtures

These tiny fixtures are self-generated test data and are not derived from a real
customer, property, person, site visit, or recording.

- `synthetic-room-context.png.base64` is an encoded 1 x 1 generated PNG used only
  to exercise photo validation and context-only authority.
- `synthetic-voice-note.wav.base64` is an encoded 2 ms mono WAV containing a
  generated repeating sample pattern. It contains no human speech.

The Base64 transport form keeps the fixtures reviewable as text. Tests decode the
content in memory and give it an unmistakably synthetic filename.

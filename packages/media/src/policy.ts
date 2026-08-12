import type { MediaPolicy } from "./types";

export const MEDIA_POLICY: MediaPolicy = Object.freeze({
  maxBytes: Object.freeze({
    AUDIO: 25 * 1024 * 1024,
    PHOTO: 10 * 1024 * 1024,
  }),
  maxCount: Object.freeze({
    AUDIO: 1,
    PHOTO: 8,
  }),
  maxFilenameLength: 120,
  maxReadGrantSeconds: 300,
});

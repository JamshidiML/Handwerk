import { describe, expect, it } from "vitest";
import { mediaErrorCode } from "./media-errors";

describe("capture media errors", () => {
  it("maps native abort failures to a user-cancelled state", () => {
    expect(mediaErrorCode(new DOMException("cancelled", "AbortError"))).toBe(
      "CANCELLED",
    );
    expect(mediaErrorCode({ name: "AbortError" })).toBe("CANCELLED");
  });
});

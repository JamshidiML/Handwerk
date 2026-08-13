import { describe, expect, it } from "vitest";

import {
  completeProjectDeletion,
  confirmProjectDeletion,
  requestProjectDeletion,
} from "../src/index";
import { id, LATER, NOW, ORG, USER } from "./fixtures";

describe("project deletion state", () => {
  const requested = requestProjectDeletion({
    id: id("deletion-1"),
    organisationId: ORG,
    projectId: id("project-1"),
    requestedByUserId: USER,
    now: NOW,
  });

  it("starts without implied consequence acknowledgement", () => {
    expect(requested).toMatchObject({
      status: "REQUESTED",
      consequenceAcknowledged: false,
      version: 1,
    });
  });

  it("requires explicit consequence acknowledgement", () => {
    expect(() =>
      confirmProjectDeletion(requested, 1, false, LATER),
    ).toThrowError(/explicitly acknowledged/);
  });

  it("confirms once and increments the optimistic version", () => {
    expect(confirmProjectDeletion(requested, 1, true, LATER)).toMatchObject({
      status: "CONFIRMED",
      consequenceAcknowledged: true,
      version: 2,
    });
  });

  it("hard-deletes only a confirmed demo request", () => {
    expect(() =>
      completeProjectDeletion(requested, 1, true, LATER),
    ).toThrowError(/limited to/);
    const confirmed = confirmProjectDeletion(requested, 1, true, LATER);
    expect(() =>
      completeProjectDeletion(confirmed, 2, false, LATER),
    ).toThrowError(/demo-mode/);
    expect(completeProjectDeletion(confirmed, 2, true, LATER)).toMatchObject({
      status: "COMPLETED",
      version: 3,
    });
  });

  it("rejects stale deletion updates", () => {
    expect(() =>
      confirmProjectDeletion(requested, 99, true, LATER),
    ).toThrowError(/Expected version/);
  });
});

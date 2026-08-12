import type {
  DeletionRequest,
  EntityId,
  IsoDateTime,
  OrganisationId,
  UserId,
} from "@handwerk/contracts";

import { assertExpectedVersion } from "./offer-draft";
import { invariant } from "./errors";

export function requestProjectDeletion(input: {
  id: EntityId;
  organisationId: OrganisationId;
  projectId: EntityId;
  requestedByUserId: UserId;
  now: IsoDateTime;
}): DeletionRequest {
  return {
    id: input.id,
    organisationId: input.organisationId,
    projectId: input.projectId,
    requestedByUserId: input.requestedByUserId,
    status: "REQUESTED",
    consequenceAcknowledged: false,
    createdAt: input.now,
    updatedAt: input.now,
    version: 1,
  };
}

export function confirmProjectDeletion(
  request: DeletionRequest,
  expectedVersion: number,
  consequenceAcknowledged: boolean,
  now: IsoDateTime,
): DeletionRequest {
  assertExpectedVersion(request.version, expectedVersion);
  invariant(
    request.status === "REQUESTED",
    "DELETION_NOT_ALLOWED",
    "Only a requested deletion can be confirmed.",
  );
  invariant(
    consequenceAcknowledged,
    "DELETION_NOT_ALLOWED",
    "Deletion consequences must be explicitly acknowledged.",
  );
  return {
    ...request,
    status: "CONFIRMED",
    consequenceAcknowledged: true,
    updatedAt: now,
    version: request.version + 1,
  };
}

export function completeProjectDeletion(
  request: DeletionRequest,
  expectedVersion: number,
  demoMode: boolean,
  now: IsoDateTime,
): DeletionRequest {
  assertExpectedVersion(request.version, expectedVersion);
  invariant(
    demoMode &&
      request.status === "CONFIRMED" &&
      request.consequenceAcknowledged,
    "DELETION_NOT_ALLOWED",
    "Hard deletion is limited to an explicitly confirmed demo-mode request.",
  );
  return {
    ...request,
    status: "COMPLETED",
    updatedAt: now,
    version: request.version + 1,
  };
}

import type { EntityId } from "@handwerk/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import {
  AuditService,
  DELETION_CONFIRMATION_PHRASE,
  InMemoryFixedWindowRateLimiter,
  ProjectPrivacyService,
  toSafeApiError,
} from "../src/index";
import {
  NOW,
  ORG_A,
  ORG_B,
  PROJECT_A,
  PROJECT_B,
  RAW_TRANSCRIPT,
  USER_A,
  USER_B,
  MemoryAuditStore,
  MemoryPrivacyStore,
  createContext,
} from "./helpers";

describe("project privacy service", () => {
  let privacyStore: MemoryPrivacyStore;
  let auditStore: MemoryAuditStore;
  let service: ProjectPrivacyService;
  let sequence: number;

  beforeEach(() => {
    privacyStore = new MemoryPrivacyStore();
    auditStore = new MemoryAuditStore();
    sequence = 0;
    service = new ProjectPrivacyService({
      store: privacyStore,
      audit: new AuditService({
        store: auditStore,
        now: () => NOW,
        createId: () => `audit-${++sequence}`,
      }),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
      now: () => NOW,
      createId: () => `deletion-${++sequence}`,
    });
  });

  it("exports only an allowlisted, same-tenant project representation", async () => {
    const download = await service.exportProjectData(createContext(), {
      projectId: PROJECT_A,
    });
    const text = new TextDecoder().decode(download.body);

    expect(download.filename).toBe("handwerk-projektdaten-project-a.json");
    expect(download.headers["Content-Disposition"]).toContain("attachment");
    expect(download.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(text).toContain(RAW_TRANSCRIPT);
    expect(text).not.toContain("private/internal/object-key-never-export");
    expect(text).not.toContain("signedUrl");
    expect(text).not.toContain("providerPayload");
    expect(JSON.stringify(auditStore.events)).not.toContain(RAW_TRANSCRIPT);
    expect(auditStore.events.at(-1)?.metadata).toMatchObject({
      projectId: PROJECT_A,
      format: "JSON",
      outcome: "SUCCEEDED",
    });
  });

  it("returns the same non-enumerating error for foreign and absent project IDs", async () => {
    const errors: unknown[] = [];
    for (const projectId of [PROJECT_B, "project-does-not-exist"] as const) {
      try {
        await service.exportProjectData(createContext(), { projectId });
      } catch (error) {
        errors.push(toSafeApiError(error, "request-enumeration"));
      }
    }
    expect(errors).toEqual([
      {
        code: "FORBIDDEN_OR_NOT_FOUND",
        message: "Die angeforderte Ressource wurde nicht gefunden.",
        requestId: "request-enumeration",
      },
      {
        code: "FORBIDDEN_OR_NOT_FOUND",
        message: "Die angeforderte Ressource wurde nicht gefunden.",
        requestId: "request-enumeration",
      },
    ]);
  });

  it("rejects mass assignment instead of accepting a client organisation", async () => {
    await expect(
      service.exportProjectData(createContext(), {
        projectId: PROJECT_A,
        organisationId: ORG_B,
        actorUserId: USER_B,
        role: "OWNER",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects an adapter that returns a foreign tenant aggregate", async () => {
    privacyStore.returnWrongTenantAggregate = true;
    await expect(
      service.exportProjectData(createContext(), { projectId: PROJECT_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_OR_NOT_FOUND" });
  });

  it("rejects a same-tenant aggregate that splices another project's evidence", async () => {
    const aggregate = privacyStore.aggregates.get(`${ORG_A}:${PROJECT_A}`);
    if (!aggregate) throw new Error("Synthetic project fixture is missing.");
    aggregate.evidence[0]!.siteVisitId = "another-project-visit" as EntityId;

    await expect(
      service.exportProjectData(createContext(), { projectId: PROJECT_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_OR_NOT_FOUND" });
  });

  it("omits a same-tenant foreign-project citation from a revision export", async () => {
    const aggregate = privacyStore.aggregates.get(`${ORG_A}:${PROJECT_A}`);
    if (!aggregate) throw new Error("Synthetic project fixture is missing.");
    aggregate.draft = {
      id: "draft-project-a" as EntityId,
      organisationId: ORG_A,
      projectId: PROJECT_A,
      state: "READY_FOR_REVIEW",
      currentRevision: 1,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    };
    aggregate.revision = {
      id: "revision-project-a" as EntityId,
      organisationId: ORG_A,
      offerDraftId: aggregate.draft.id,
      revision: 1,
      lines: [
        {
          id: "line-project-a" as EntityId,
          organisationId: ORG_A,
          priceBookItemId: "pricebook-item-a" as EntityId,
          itemCode: "MAL-100",
          description: "Synthetische Position",
          quantity: { value: "12", unit: "M2" },
          unitPrice: { currency: "EUR", minor: 4_100 },
          netTotal: { currency: "EUR", minor: 49_200 },
          taxCategory: "STANDARD_19",
          taxRateBasisPoints: 1_900,
          taxTotal: { currency: "EUR", minor: 9_348 },
          grossTotal: { currency: "EUR", minor: 58_548 },
          calculation: "12 * 41,00 EUR",
          citations: [
            {
              id: "citation-foreign-project" as EntityId,
              organisationId: ORG_A,
              sourceType: "TRANSCRIPT_SEGMENT",
              sourceEntityId: "project-other-transcript" as EntityId,
              locator: "foreign-project-locator-never-export",
              extractionVersion: "fake-v1",
              explanation: "foreign-project-explanation-never-export",
              authority: "CONTEXT_ONLY",
            },
          ],
          risk: "LOW_RISK",
          origin: "GENERATED",
        },
      ],
      excludedItems: [
        {
          key: "foreign-excluded-key-never-export",
          reason: "foreign-excluded-reason-never-export",
          citations: [
            {
              id: "citation-foreign-excluded" as EntityId,
              organisationId: ORG_A,
              sourceType: "TRANSCRIPT_SEGMENT",
              sourceEntityId:
                "foreign-excluded-source-never-export" as EntityId,
              locator: "foreign-excluded-locator-never-export",
              extractionVersion: "fake-v1",
              explanation: "foreign-excluded-explanation-never-export",
              authority: "CONTEXT_ONLY",
            },
          ],
        },
      ],
      unmatchedItems: [],
      netTotal: { currency: "EUR", minor: 49_200 },
      taxTotal: { currency: "EUR", minor: 9_348 },
      grossTotal: { currency: "EUR", minor: 58_548 },
      createdByUserId: USER_A,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    };

    const download = await service.exportProjectData(createContext(), {
      projectId: PROJECT_A,
    });
    const text = new TextDecoder().decode(download.body);
    const exported = JSON.parse(text);

    expect(text).toContain("Synthetische Position");
    expect(text).not.toContain("foreign-project-locator-never-export");
    expect(text).not.toContain("foreign-project-explanation-never-export");
    expect(text).not.toContain("project-other-transcript");
    expect(text).not.toContain("foreign-excluded-locator-never-export");
    expect(text).not.toContain("foreign-excluded-source-never-export");
    expect(exported.revision.lines[0]).not.toHaveProperty("citations");
    expect(exported.revision.lines[0]).not.toHaveProperty("priceBookItemId");
    expect(exported.revision.excludedItems[0]).not.toHaveProperty("citations");
    expect(exported.draft).not.toHaveProperty("id");
  });

  it("creates a confirmed deletion request only after explicit consequences", async () => {
    await expect(
      service.requestProjectDeletion(createContext(), {
        projectId: PROJECT_A,
        consequenceAcknowledged: false,
        confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const request = await service.requestProjectDeletion(createContext(), {
      projectId: PROJECT_A,
      consequenceAcknowledged: true,
      confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
    });
    expect(request).toMatchObject({
      projectId: PROJECT_A,
      status: "CONFIRMED",
      consequenceAcknowledged: true,
    });
  });

  it("blocks cross-tenant deletion requests", async () => {
    await expect(
      service.requestProjectDeletion(createContext(), {
        projectId: PROJECT_B,
        consequenceAcknowledged: true,
        confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_OR_NOT_FOUND" });
    expect(privacyStore.requests.size).toBe(0);
  });

  it("completes deletion only for the requesting owner in demo mode", async () => {
    const context = createContext();
    const request = await service.requestProjectDeletion(context, {
      projectId: PROJECT_A,
      consequenceAcknowledged: true,
      confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
    });
    const completed = await service.completeDemoProjectDeletion(context, {
      projectId: PROJECT_A,
      deletionRequestId: request.id,
      confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
    });
    expect(completed.status).toBe("COMPLETED");
    expect(auditStore.events.map((event) => event.type)).toContain(
      "DEMO_DATA_DELETED",
    );
    await expect(
      service.exportProjectData(context, { projectId: PROJECT_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_OR_NOT_FOUND" });
  });

  it("hard-stops immediate deletion outside demo mode", async () => {
    const demoContext = createContext();
    const request = await service.requestProjectDeletion(demoContext, {
      projectId: PROJECT_A,
      consequenceAcknowledged: true,
      confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
    });
    await expect(
      service.completeDemoProjectDeletion(
        createContext({
          demoMode: false,
          authenticationMethod: "SESSION",
        }),
        {
          projectId: PROJECT_A,
          deletionRequestId: request.id,
          confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
        },
      ),
    ).rejects.toMatchObject({ code: "FAILED_SAFE" });
  });

  it("does not accept a foreign tenant deletion request ID", async () => {
    const foreignContext = createContext({
      organisationId: ORG_B,
      actorUserId: USER_B,
    });
    const foreignRequest = await service.requestProjectDeletion(
      foreignContext,
      {
        projectId: PROJECT_B,
        consequenceAcknowledged: true,
        confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
      },
    );

    await expect(
      service.completeDemoProjectDeletion(createContext(), {
        projectId: PROJECT_A,
        deletionRequestId: foreignRequest.id as EntityId,
        confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_OR_NOT_FOUND" });
  });

  it("requires owner role for deletion but permits member data export", async () => {
    const member = createContext({ role: "MEMBER" });
    await expect(
      service.exportProjectData(member, { projectId: PROJECT_A }),
    ).resolves.toMatchObject({ mediaType: "application/json" });
    await expect(
      service.requestProjectDeletion(member, {
        projectId: PROJECT_A,
        consequenceAcknowledged: true,
        confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_OR_NOT_FOUND" });
  });
});

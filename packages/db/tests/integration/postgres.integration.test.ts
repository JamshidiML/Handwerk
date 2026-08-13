import type {
  EntityId,
  IsoDateTime,
  OfferDraft,
  OrganisationId,
  SourceCitation,
  UserId,
} from "@handwerk/contracts";
import {
  applyCommercialEdit,
  approveOfferDraft,
  createOfferDraftRevision,
  createOfferLine,
  requestProjectDeletion,
} from "@handwerk/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  loadPg,
  PostgresCustomerProjectRepository,
  PostgresDeletionRepository,
  PostgresMembershipRepository,
  PostgresOfferDraftRepository,
  PostgresPriceBookRepository,
  runMigrations,
  seedSyntheticDemo,
  type PgPool,
  type PgClient,
} from "../../src/index";

const connectionString = process.env.HANDWERK_TEST_DATABASE_URL;
const hasExplicitSyntheticDatabase =
  connectionString?.endsWith("/handwerk_t01_test") === true;

if (
  process.env.HANDWERK_REQUIRE_DB_INTEGRATION === "true" &&
  !hasExplicitSyntheticDatabase
) {
  throw new Error(
    "Database integration is required but HANDWERK_TEST_DATABASE_URL does not target /handwerk_t01_test.",
  );
}

const describeDatabase = hasExplicitSyntheticDatabase
  ? describe
  : describe.skip;

const NOW = "2026-08-12T11:00:00.000Z" as IsoDateTime;
const LATER = "2026-08-12T11:05:00.000Z" as IsoDateTime;
const ORG = "org-westblick" as OrganisationId;
const OTHER_ORG = "org-other" as OrganisationId;
const USER = "user-demo-owner" as UserId;
const id = (value: string) => value as EntityId;

describeDatabase("PostgreSQL domain persistence", () => {
  let pool: PgPool;
  let setupClient: PgClient;

  beforeAll(async () => {
    const { Pool } = loadPg();
    pool = new Pool({ connectionString: connectionString! });
    setupClient = await pool.connect();
    await setupClient.query("DROP SCHEMA public CASCADE");
    await setupClient.query("CREATE SCHEMA public");
  });

  afterAll(async () => {
    setupClient.release?.();
    await pool.end();
  });

  it("applies a clean forward-only migration and is a no-op on rerun", async () => {
    const first = await runMigrations(setupClient);
    expect(first.map(({ name }) => name)).toEqual([
      "0001_vertical_slice_domain.sql",
    ]);
    await expect(runMigrations(setupClient)).resolves.toEqual([]);
    const stored = await pool.query<{ count: string }>(
      "SELECT count(*) AS count FROM schema_migrations",
    );
    expect(stored.rows[0]?.count).toBe("1");
  });

  it("seeds the canonical synthetic organisation and price book idempotently", async () => {
    await seedSyntheticDemo(setupClient);
    await seedSyntheticDemo(setupClient);
    const result = await pool.query<{
      organisations: string;
      projects: string;
      items: string;
    }>(`SELECT
      (SELECT count(*) FROM organisations WHERE id = 'org-westblick') AS organisations,
      (SELECT count(*) FROM projects WHERE id = 'project-wohnzimmer-bochum') AS projects,
      (SELECT count(*) FROM price_book_items WHERE organisation_id = 'org-westblick') AS items`);
    expect(result.rows[0]).toEqual({
      organisations: "1",
      projects: "1",
      items: "4",
    });
  });

  it("returns identical not-found results for unknown and foreign tenant reads", async () => {
    const repository = new PostgresCustomerProjectRepository(pool);
    await expect(
      repository.findCustomer(
        { organisationId: ORG },
        id("customer-synthetic-001"),
      ),
    ).resolves.toMatchObject({
      displayName: "Beispielkundin 01",
      synthetic: true,
    });
    await expect(
      repository.findCustomer(
        { organisationId: OTHER_ORG },
        id("customer-synthetic-001"),
      ),
    ).resolves.toBeNull();
    await expect(
      repository.findCustomer({ organisationId: ORG }, id("missing")),
    ).resolves.toBeNull();
  });

  it("enforces same-organisation relationships in PostgreSQL", async () => {
    await pool.query(
      `INSERT INTO organisations
       (id, name, locale, currency, created_at, updated_at, version)
       VALUES ('org-other', 'Other Synthetic Org', 'de-DE', 'EUR', $1, $1, 1)`,
      [NOW],
    );
    await pool.query(
      `INSERT INTO customers
       (organisation_id, id, display_name, synthetic, created_at, updated_at, version)
       VALUES ('org-other', 'foreign-customer', 'Foreign Synthetic Customer', true, $1, $1, 1)`,
      [NOW],
    );
    await expect(
      pool.query(
        `INSERT INTO projects
         (organisation_id, id, customer_id, name, synthetic, created_at, updated_at, version)
         VALUES ('org-westblick', 'bad-project', 'foreign-customer', 'Invalid', true, $1, $1, 1)`,
        [NOW],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("makes photo measurement authority impossible in the database", async () => {
    await expect(
      pool.query(
        `INSERT INTO evidence_assets (
          organisation_id, id, site_visit_id, kind, filename, media_type, size_bytes,
          checksum_sha256, object_key, authority, synthetic, created_at, updated_at, version
        ) VALUES (
          'org-westblick', 'photo-bad-authority', 'visit-wohnzimmer-001', 'PHOTO',
          'synthetic.jpg', 'image/jpeg', 100, repeat('a', 64),
          'org-westblick/synthetic.jpg', 'AUTHORITATIVE', true, $1, $1, 1
        )`,
        [NOW],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("returns only active, effective, same-tenant price-book items", async () => {
    const repository = new PostgresPriceBookRepository(pool);
    await expect(
      repository.findActiveItem(
        { organisationId: ORG },
        id("pb-item-wall-two-coats"),
        "2026-08-12",
      ),
    ).resolves.toMatchObject({
      priceBook: { active: true },
      item: { code: "MAL-WAND-2X", unitPrice: { minor: 1_290 } },
    });
    await expect(
      repository.findActiveItem(
        { organisationId: OTHER_ORG },
        id("pb-item-wall-two-coats"),
        "2026-08-12",
      ),
    ).resolves.toBeNull();
  });

  it("persists a revision and database-rejects invented prices and units", async () => {
    const priceBooks = new PostgresPriceBookRepository(pool);
    const approvedItem = await priceBooks.findActiveItem(
      { organisationId: ORG },
      id("pb-item-wall-two-coats"),
      "2026-08-12",
    );
    expect(approvedItem).not.toBeNull();
    const citation: SourceCitation = {
      id: id("citation-wall-db"),
      organisationId: ORG,
      sourceType: "EXPLICIT_MEASUREMENT",
      sourceEntityId: id("measurement-wall-db"),
      locator: "measurement-wall-db",
      extractionVersion: "deterministic-v1",
      explanation: "Synthetic explicit wall measurement",
      authority: "AUTHORITATIVE",
    };
    const line = createOfferLine({
      id: id("line-wall-db"),
      organisationId: ORG,
      priceBook: approvedItem!.priceBook,
      priceBookItem: approvedItem!.item,
      quantity: { value: "52", unit: "M2" },
      citations: [citation],
      risk: "CONFIRMED",
      origin: "GENERATED",
      asOfDate: "2026-08-12",
    });
    const draft: OfferDraft = {
      id: id("draft-db"),
      organisationId: ORG,
      projectId: id("project-wohnzimmer-bochum"),
      state: "READY_FOR_REVIEW",
      currentRevision: 1,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    };
    const revision = createOfferDraftRevision({
      id: id("revision-db-1"),
      draft,
      revision: 1,
      lines: [line],
      createdByUserId: USER,
      now: NOW,
    });
    const repository = new PostgresOfferDraftRepository(pool);
    await expect(
      repository.create({ organisationId: ORG }, draft, revision),
    ).resolves.toMatchObject({
      draft: { version: 1, currentRevision: 1 },
      revision: { netTotal: { minor: 67_080 } },
    });

    await expect(
      pool.query(
        `INSERT INTO offer_lines (
          organisation_id, id, offer_draft_id, revision, position,
          price_book_item_id, item_code, description, quantity_value, quantity_unit,
          unit_price_minor, net_total_minor, tax_category, tax_rate_basis_points,
          tax_total_minor, gross_total_minor, calculation, risk, origin
        ) VALUES (
          'org-westblick', 'tampered-line', 'draft-db', 1, 1,
          'pb-item-wall-two-coats', 'MAL-WAND-2X', 'Tampered', '1', 'M2',
          1, 1, 'STANDARD_19', 1900, 0, 1, 'tampered', 'CONFIRMED', 'EDITED'
        )`,
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      pool.query(
        `INSERT INTO offer_lines (
          organisation_id, id, offer_draft_id, revision, position,
          price_book_item_id, item_code, description, quantity_value, quantity_unit,
          unit_price_minor, net_total_minor, tax_category, tax_rate_basis_points,
          tax_total_minor, gross_total_minor, calculation, risk, origin
        ) VALUES (
          'org-westblick', 'bad-unit-line', 'draft-db', 1, 1,
          'pb-item-wall-two-coats', 'MAL-WAND-2X', 'Bad unit', '1', 'STK',
          1290, 1290, 'STANDARD_19', 1900, 245, 1535, 'bad unit', 'CONFIRMED', 'EDITED'
        )`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("enforces optimistic concurrency in the repository", async () => {
    const repository = new PostgresOfferDraftRepository(pool);
    const aggregate = await repository.findAggregate(
      { organisationId: ORG },
      id("draft-db"),
    );
    expect(aggregate).not.toBeNull();
    const edit = applyCommercialEdit({
      draft: aggregate!.draft,
      currentRevision: aggregate!.revision,
      expectedVersion: aggregate!.draft.version,
      revisionId: id("revision-db-2-stale"),
      lines: aggregate!.revision.lines,
      editedByUserId: USER,
      now: LATER,
    });
    await expect(
      repository.saveCommercialEdit({ organisationId: ORG }, 99, edit),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("binds approval to the current revision and invalidates it after edit", async () => {
    const repository = new PostgresOfferDraftRepository(pool);
    const memberships = new PostgresMembershipRepository(pool);
    const aggregate = await repository.findAggregate(
      { organisationId: ORG },
      id("draft-db"),
    );
    const reviewer = await memberships.findActiveMembership(
      { organisationId: ORG },
      USER,
    );
    expect(aggregate).not.toBeNull();
    expect(reviewer).not.toBeNull();

    const approved = approveOfferDraft({
      id: id("approval-db-1"),
      draft: aggregate!.draft,
      revision: aggregate!.revision,
      membership: reviewer!,
      expectedVersion: aggregate!.draft.version,
      approvedByUserId: USER,
      confirmationText: "Ich habe den synthetischen Entwurf geprüft.",
      unresolvedBlockingQuestions: 0,
      now: LATER,
    });
    const savedApproval = await repository.saveApproval(
      { organisationId: ORG },
      aggregate!.draft.version,
      approved,
    );
    expect(savedApproval).toMatchObject({
      draft: { state: "APPROVED", approvedRevision: 1, version: 2 },
      approval: { revision: 1 },
    });

    const edit = applyCommercialEdit({
      draft: savedApproval.draft,
      currentRevision: savedApproval.revision,
      expectedVersion: savedApproval.draft.version,
      revisionId: id("revision-db-2"),
      lines: savedApproval.revision.lines.map((line) => ({
        ...line,
        origin: "EDITED" as const,
      })),
      editedByUserId: USER,
      now: "2026-08-12T11:10:00.000Z" as IsoDateTime,
      activeApproval: savedApproval.approval!,
    });
    const savedEdit = await repository.saveCommercialEdit(
      { organisationId: ORG },
      savedApproval.draft.version,
      edit,
    );
    expect(savedEdit).toMatchObject({
      draft: {
        state: "READY_FOR_REVIEW",
        currentRevision: 2,
        version: 3,
      },
    });
    expect(savedEdit.draft.approvedRevision).toBeUndefined();
    expect(savedEdit.approval).toBeUndefined();
    const invalidated = await pool.query<{
      invalidation_reason: string;
      invalidated_at: Date | null;
    }>(
      `SELECT invalidation_reason, invalidated_at FROM human_approvals
       WHERE organisation_id = 'org-westblick' AND id = 'approval-db-1'`,
    );
    expect(invalidated.rows[0]?.invalidation_reason).toBe("COMMERCIAL_EDIT");
    expect(invalidated.rows[0]?.invalidated_at).not.toBeNull();
  });

  it("database-blocks exports without current human approval", async () => {
    await expect(
      pool.query(
        `INSERT INTO export_artifacts (
          organisation_id, id, offer_draft_id, revision, kind, filename,
          media_type, checksum_sha256, size_bytes, created_at, updated_at, version
        ) VALUES (
          'org-westblick', 'export-stale', 'draft-db', 2, 'PDF', 'synthetic.pdf',
          'application/pdf', repeat('b', 64), 100, $1, $1, 1
        )`,
        [NOW],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("project demo deletion is confirmed, scoped, cascading, and leaves retention boundaries", async () => {
    const repository = new PostgresDeletionRepository(pool);
    const request = requestProjectDeletion({
      id: id("deletion-db-1"),
      organisationId: ORG,
      projectId: id("project-wohnzimmer-bochum"),
      requestedByUserId: USER,
      now: NOW,
    });
    await repository.createRequest({ organisationId: ORG }, request);
    const confirmed = await repository.confirmRequest(
      { organisationId: ORG },
      request.id,
      1,
      LATER,
    );
    await expect(
      repository.completeDemoDeletion(
        { organisationId: OTHER_ORG },
        request.id,
        confirmed.version,
        USER,
        LATER,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN_OR_NOT_FOUND" });
    await expect(
      repository.completeDemoDeletion(
        { organisationId: ORG },
        request.id,
        confirmed.version,
        USER,
        LATER,
      ),
    ).resolves.toEqual({
      requestId: request.id,
      completedAt: LATER,
      objectKeysToDelete: [],
    });
    const remaining = await pool.query<{
      projects: string;
      customers: string;
      price_books: string;
      receipts: string;
    }>(`SELECT
      (SELECT count(*) FROM projects WHERE id = 'project-wohnzimmer-bochum') AS projects,
      (SELECT count(*) FROM customers WHERE id = 'customer-synthetic-001') AS customers,
      (SELECT count(*) FROM price_books WHERE id = 'pricebook-westblick-2026') AS price_books,
      (SELECT count(*) FROM deletion_receipts WHERE request_id = 'deletion-db-1') AS receipts`);
    expect(remaining.rows[0]).toEqual({
      projects: "0",
      customers: "1",
      price_books: "1",
      receipts: "1",
    });
  });
});

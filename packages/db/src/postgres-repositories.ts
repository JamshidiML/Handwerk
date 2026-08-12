import type {
  ClarificationQuestion,
  Customer,
  DeletionRequest,
  EntityId,
  HumanApproval,
  IsoDateTime,
  Membership,
  OfferDraft,
  OfferDraftRevision,
  OfferLine,
  OrganisationId,
  PriceBook,
  PriceBookItem,
  Project,
  SiteVisit,
  SourceCitation,
  UserId,
} from "@handwerk/contracts";
import {
  assertExpectedVersion,
  assertRevisionIntegrity,
  completeProjectDeletion,
  confirmProjectDeletion,
  DomainInvariantError,
  invariant,
  type CustomerProjectRepository,
  type DeletionRepository,
  type DemoDeletionResult,
  type MembershipRepository,
  type OfferDraftAggregate,
  type OfferDraftRepository,
  type PriceBookRepository,
  type TenantScope,
} from "@handwerk/domain";

import type { PgPool, PgQueryable } from "./pg";
import { withTransaction } from "./pg";

function entityId(value: string): EntityId {
  return value as EntityId;
}

function organisationId(value: string): OrganisationId {
  return value as OrganisationId;
}

function userId(value: string): UserId {
  return value as UserId;
}

function isoDateTime(value: Date | string): IsoDateTime {
  return new Date(value).toISOString() as IsoDateTime;
}

function isoDate(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

function integer(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("PostgreSQL integer is outside the JavaScript safe range.");
  }
  return parsed;
}

function jsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
  }
  throw new Error("Expected a PostgreSQL JSON array.");
}

interface TenantRow {
  organisation_id: string;
  id: string;
  created_at: Date | string;
  updated_at: Date | string;
  version: number;
}

interface CustomerRow extends TenantRow {
  display_name: string;
  synthetic: boolean;
}

interface ProjectRow extends TenantRow {
  customer_id: string;
  name: string;
  location_label: string | null;
  synthetic: boolean;
}

interface SiteVisitRow extends TenantRow {
  project_id: string;
  status: SiteVisit["status"];
  started_at: Date | string;
  completed_at: Date | string | null;
}

interface MembershipRow extends TenantRow {
  user_id: string;
  role: Membership["role"];
  active: boolean;
}

interface PriceBookRow extends TenantRow {
  name: string;
  active: boolean;
}

interface PriceBookItemRow extends TenantRow {
  price_book_id: string;
  code: string;
  description: string;
  category: string;
  unit: PriceBookItem["unit"];
  unit_price_minor: number | string;
  tax_category: PriceBookItem["taxCategory"];
  tax_rate_basis_points: number;
  active: boolean;
  valid_from: Date | string | null;
  valid_to: Date | string | null;
  synonyms: unknown;
}

interface DraftRow extends TenantRow {
  project_id: string;
  state: OfferDraft["state"];
  current_revision: number;
  approved_revision: number | null;
}

interface RevisionRow extends TenantRow {
  offer_draft_id: string;
  revision: number;
  excluded_items: unknown;
  unmatched_items: unknown;
  net_total_minor: number | string;
  tax_total_minor: number | string;
  gross_total_minor: number | string;
  created_by_user_id: string;
}

interface LineRow {
  organisation_id: string;
  id: string;
  price_book_item_id: string;
  item_code: string;
  description: string;
  quantity_value: string;
  quantity_unit: OfferLine["quantity"]["unit"];
  unit_price_minor: number | string;
  net_total_minor: number | string;
  tax_category: OfferLine["taxCategory"];
  tax_rate_basis_points: number;
  tax_total_minor: number | string;
  gross_total_minor: number | string;
  calculation: string;
  risk: OfferLine["risk"];
  origin: OfferLine["origin"];
}

interface CitationRow {
  organisation_id: string;
  id: string;
  source_type: SourceCitation["sourceType"];
  source_entity_id: string;
  locator: string;
  extraction_version: string;
  explanation: string;
  authority: SourceCitation["authority"];
  offer_line_id?: string;
}

interface ApprovalRow extends TenantRow {
  offer_draft_id: string;
  revision: number;
  approved_by_user_id: string;
  confirmation_text: string;
  approved_at: Date | string;
  invalidated_at: Date | string | null;
  invalidation_reason: string | null;
}

interface DeletionRow extends TenantRow {
  project_id: string;
  requested_by_user_id: string;
  status: DeletionRequest["status"];
  consequence_acknowledged: boolean;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    displayName: row.display_name,
    synthetic: true,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapProject(row: ProjectRow): Project {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    customerId: entityId(row.customer_id),
    name: row.name,
    ...(row.location_label === null
      ? {}
      : { locationLabel: row.location_label }),
    synthetic: true,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapSiteVisit(row: SiteVisitRow): SiteVisit {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    projectId: entityId(row.project_id),
    status: row.status,
    startedAt: isoDateTime(row.started_at),
    ...(row.completed_at === null
      ? {}
      : { completedAt: isoDateTime(row.completed_at) }),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapMembership(row: MembershipRow): Membership {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    userId: userId(row.user_id),
    role: row.role,
    active: row.active,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapPriceBook(row: PriceBookRow): PriceBook {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    name: row.name,
    active: row.active,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapPriceBookItem(row: PriceBookItemRow): PriceBookItem {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    priceBookId: entityId(row.price_book_id),
    code: row.code,
    description: row.description,
    category: row.category,
    unit: row.unit,
    unitPrice: { currency: "EUR", minor: integer(row.unit_price_minor) },
    taxCategory: row.tax_category,
    taxRateBasisPoints: row.tax_rate_basis_points,
    active: row.active,
    ...(row.valid_from === null ? {} : { validFrom: isoDate(row.valid_from) }),
    ...(row.valid_to === null ? {} : { validTo: isoDate(row.valid_to) }),
    synonyms: jsonArray<string>(row.synonyms),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapDraft(row: DraftRow): OfferDraft {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    projectId: entityId(row.project_id),
    state: row.state,
    currentRevision: row.current_revision,
    ...(row.approved_revision === null
      ? {}
      : { approvedRevision: row.approved_revision }),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapCitation(row: CitationRow): SourceCitation {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    sourceType: row.source_type,
    sourceEntityId: entityId(row.source_entity_id),
    locator: row.locator,
    extractionVersion: row.extraction_version,
    explanation: row.explanation,
    authority: row.authority,
  };
}

function mapLine(row: LineRow, citations: SourceCitation[]): OfferLine {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    priceBookItemId: entityId(row.price_book_item_id),
    itemCode: row.item_code,
    description: row.description,
    quantity: { value: row.quantity_value, unit: row.quantity_unit },
    unitPrice: { currency: "EUR", minor: integer(row.unit_price_minor) },
    netTotal: { currency: "EUR", minor: integer(row.net_total_minor) },
    taxCategory: row.tax_category,
    taxRateBasisPoints: row.tax_rate_basis_points,
    taxTotal: { currency: "EUR", minor: integer(row.tax_total_minor) },
    grossTotal: { currency: "EUR", minor: integer(row.gross_total_minor) },
    calculation: row.calculation,
    citations,
    risk: row.risk,
    origin: row.origin,
  };
}

function mapApproval(row: ApprovalRow): HumanApproval {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    offerDraftId: entityId(row.offer_draft_id),
    revision: row.revision,
    approvedByUserId: userId(row.approved_by_user_id),
    confirmationText: row.confirmation_text,
    approvedAt: isoDateTime(row.approved_at),
    ...(row.invalidated_at === null
      ? {}
      : { invalidatedAt: isoDateTime(row.invalidated_at) }),
    ...(row.invalidation_reason === null
      ? {}
      : { invalidationReason: row.invalidation_reason }),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

function mapDeletionRequest(row: DeletionRow): DeletionRequest {
  return {
    id: entityId(row.id),
    organisationId: organisationId(row.organisation_id),
    projectId: entityId(row.project_id),
    requestedByUserId: userId(row.requested_by_user_id),
    status: row.status,
    consequenceAcknowledged: row.consequence_acknowledged,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    version: row.version,
  };
}

async function findAggregate(
  database: PgQueryable,
  scope: TenantScope,
  draftId: EntityId,
): Promise<OfferDraftAggregate | null> {
  const draftResult = await database.query<DraftRow>(
    "SELECT * FROM offer_drafts WHERE organisation_id = $1 AND id = $2",
    [scope.organisationId, draftId],
  );
  const draftRow = draftResult.rows[0];
  if (draftRow === undefined) {
    return null;
  }
  const draft = mapDraft(draftRow);

  const revisionResult = await database.query<RevisionRow>(
    `SELECT * FROM offer_draft_revisions
     WHERE organisation_id = $1 AND offer_draft_id = $2 AND revision = $3`,
    [scope.organisationId, draftId, draft.currentRevision],
  );
  const revisionRow = revisionResult.rows[0];
  invariant(
    revisionRow !== undefined,
    "INVALID_REVISION",
    "Draft current revision is missing.",
  );

  const lineResult = await database.query<LineRow>(
    `SELECT * FROM offer_lines
     WHERE organisation_id = $1 AND offer_draft_id = $2 AND revision = $3
     ORDER BY position`,
    [scope.organisationId, draftId, draft.currentRevision],
  );
  const citationResult = await database.query<CitationRow>(
    `SELECT citation.*, link.offer_line_id
     FROM offer_line_citations link
     JOIN source_citations citation
       ON citation.organisation_id = link.organisation_id
      AND citation.id = link.citation_id
     WHERE link.organisation_id = $1
       AND link.offer_draft_id = $2
       AND link.revision = $3
     ORDER BY link.offer_line_id, link.position`,
    [scope.organisationId, draftId, draft.currentRevision],
  );
  const citationsByLine = new Map<string, SourceCitation[]>();
  for (const row of citationResult.rows) {
    const lineId = row.offer_line_id;
    if (lineId === undefined) continue;
    const citations = citationsByLine.get(lineId) ?? [];
    citations.push(mapCitation(row));
    citationsByLine.set(lineId, citations);
  }
  const lines = lineResult.rows.map((row) =>
    mapLine(row, citationsByLine.get(row.id) ?? []),
  );

  const approvalResult = await database.query<ApprovalRow>(
    `SELECT * FROM human_approvals
     WHERE organisation_id = $1 AND offer_draft_id = $2 AND invalidated_at IS NULL
     ORDER BY approved_at DESC LIMIT 1`,
    [scope.organisationId, draftId],
  );
  const approvalRow = approvalResult.rows[0];
  const revision: OfferDraftRevision = {
    id: entityId(revisionRow.id),
    organisationId: organisationId(revisionRow.organisation_id),
    offerDraftId: entityId(revisionRow.offer_draft_id),
    revision: revisionRow.revision,
    lines,
    excludedItems: jsonArray<OfferDraftRevision["excludedItems"][number]>(
      revisionRow.excluded_items,
    ),
    unmatchedItems: jsonArray<OfferDraftRevision["unmatchedItems"][number]>(
      revisionRow.unmatched_items,
    ),
    netTotal: { currency: "EUR", minor: integer(revisionRow.net_total_minor) },
    taxTotal: { currency: "EUR", minor: integer(revisionRow.tax_total_minor) },
    grossTotal: {
      currency: "EUR",
      minor: integer(revisionRow.gross_total_minor),
    },
    createdByUserId: userId(revisionRow.created_by_user_id),
    createdAt: isoDateTime(revisionRow.created_at),
    updatedAt: isoDateTime(revisionRow.updated_at),
    version: revisionRow.version,
  };

  return {
    draft,
    revision,
    ...(approvalRow === undefined
      ? {}
      : { approval: mapApproval(approvalRow) }),
  };
}

async function insertCitation(
  database: PgQueryable,
  citation: SourceCitation,
  offerDraftId: EntityId,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    `INSERT INTO source_citations (
      organisation_id, id, project_id, source_type, source_entity_id, locator,
      extraction_version, explanation, authority
    ) SELECT $1, $2, draft.project_id, $3, $4, $5, $6, $7, $8
      FROM offer_drafts draft
      WHERE draft.organisation_id = $1 AND draft.id = $9
    ON CONFLICT (organisation_id, id) DO UPDATE SET id = EXCLUDED.id
      WHERE source_citations.project_id = EXCLUDED.project_id
        AND source_citations.source_type = EXCLUDED.source_type
        AND source_citations.source_entity_id = EXCLUDED.source_entity_id
        AND source_citations.locator = EXCLUDED.locator
        AND source_citations.extraction_version = EXCLUDED.extraction_version
        AND source_citations.explanation = EXCLUDED.explanation
        AND source_citations.authority = EXCLUDED.authority
    RETURNING id`,
    [
      citation.organisationId,
      citation.id,
      citation.sourceType,
      citation.sourceEntityId,
      citation.locator,
      citation.extractionVersion,
      citation.explanation,
      citation.authority,
      offerDraftId,
    ],
  );
  invariant(
    result.rowCount === 1,
    "INVALID_REVISION",
    "Citation IDs cannot be reused across projects or with different provenance.",
  );
}

async function insertRevision(
  database: PgQueryable,
  revision: OfferDraftRevision,
): Promise<void> {
  await database.query(
    `INSERT INTO offer_draft_revisions (
      organisation_id, id, offer_draft_id, revision, excluded_items,
      unmatched_items, net_total_minor, tax_total_minor, gross_total_minor,
      created_by_user_id, created_at, updated_at, version
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)`,
    [
      revision.organisationId,
      revision.id,
      revision.offerDraftId,
      revision.revision,
      JSON.stringify(revision.excludedItems),
      JSON.stringify(revision.unmatchedItems),
      revision.netTotal.minor,
      revision.taxTotal.minor,
      revision.grossTotal.minor,
      revision.createdByUserId,
      revision.createdAt,
      revision.updatedAt,
      revision.version,
    ],
  );

  for (const [position, line] of revision.lines.entries()) {
    for (const citation of line.citations) {
      await insertCitation(database, citation, revision.offerDraftId);
    }
    await database.query(
      `INSERT INTO offer_lines (
        organisation_id, id, offer_draft_id, revision, position,
        price_book_item_id, item_code, description, quantity_value, quantity_unit,
        unit_price_minor, net_total_minor, tax_category, tax_rate_basis_points,
        tax_total_minor, gross_total_minor, calculation, risk, origin
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      )`,
      [
        line.organisationId,
        line.id,
        revision.offerDraftId,
        revision.revision,
        position,
        line.priceBookItemId,
        line.itemCode,
        line.description,
        line.quantity.value,
        line.quantity.unit,
        line.unitPrice.minor,
        line.netTotal.minor,
        line.taxCategory,
        line.taxRateBasisPoints,
        line.taxTotal.minor,
        line.grossTotal.minor,
        line.calculation,
        line.risk,
        line.origin,
      ],
    );
    for (const [citationPosition, citation] of line.citations.entries()) {
      await database.query(
        `INSERT INTO offer_line_citations (
          organisation_id, offer_draft_id, revision, offer_line_id, citation_id, position
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          line.organisationId,
          revision.offerDraftId,
          revision.revision,
          line.id,
          citation.id,
          citationPosition,
        ],
      );
    }
  }
}

export class PostgresCustomerProjectRepository
  implements CustomerProjectRepository
{
  constructor(private readonly database: PgQueryable) {}

  async findCustomer(
    scope: TenantScope,
    id: EntityId,
  ): Promise<Customer | null> {
    const result = await this.database.query<CustomerRow>(
      "SELECT * FROM customers WHERE organisation_id = $1 AND id = $2",
      [scope.organisationId, id],
    );
    return result.rows[0] === undefined ? null : mapCustomer(result.rows[0]);
  }

  async findProject(scope: TenantScope, id: EntityId): Promise<Project | null> {
    const result = await this.database.query<ProjectRow>(
      "SELECT * FROM projects WHERE organisation_id = $1 AND id = $2",
      [scope.organisationId, id],
    );
    return result.rows[0] === undefined ? null : mapProject(result.rows[0]);
  }

  async findSiteVisit(
    scope: TenantScope,
    id: EntityId,
  ): Promise<SiteVisit | null> {
    const result = await this.database.query<SiteVisitRow>(
      "SELECT * FROM site_visits WHERE organisation_id = $1 AND id = $2",
      [scope.organisationId, id],
    );
    return result.rows[0] === undefined ? null : mapSiteVisit(result.rows[0]);
  }
}

export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private readonly database: PgQueryable) {}

  async findActiveMembership(
    scope: TenantScope,
    actorUserId: UserId,
  ): Promise<Membership | null> {
    const result = await this.database.query<MembershipRow>(
      `SELECT * FROM memberships
       WHERE organisation_id = $1 AND user_id = $2 AND active`,
      [scope.organisationId, actorUserId],
    );
    return result.rows[0] === undefined ? null : mapMembership(result.rows[0]);
  }
}

export class PostgresPriceBookRepository implements PriceBookRepository {
  constructor(private readonly database: PgQueryable) {}

  async findActiveItem(
    scope: TenantScope,
    itemId: EntityId,
    asOfDate: string,
  ): Promise<{ priceBook: PriceBook; item: PriceBookItem } | null> {
    const result = await this.database.query<
      PriceBookItemRow & {
        book_id: string;
        book_name: string;
        book_active: boolean;
        book_created_at: Date | string;
        book_updated_at: Date | string;
        book_version: number;
      }
    >(
      `SELECT item.*, book.id AS book_id, book.name AS book_name,
              book.active AS book_active, book.created_at AS book_created_at,
              book.updated_at AS book_updated_at, book.version AS book_version
       FROM price_book_items item
       JOIN price_books book
         ON book.organisation_id = item.organisation_id
        AND book.id = item.price_book_id
       WHERE item.organisation_id = $1
         AND item.id = $2
         AND item.active
         AND book.active
         AND (item.valid_from IS NULL OR item.valid_from <= $3::date)
         AND (item.valid_to IS NULL OR item.valid_to >= $3::date)`,
      [scope.organisationId, itemId, asOfDate],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      priceBook: mapPriceBook({
        organisation_id: row.organisation_id,
        id: row.book_id,
        name: row.book_name,
        active: row.book_active,
        created_at: row.book_created_at,
        updated_at: row.book_updated_at,
        version: row.book_version,
      }),
      item: mapPriceBookItem(row),
    };
  }
}

export class PostgresOfferDraftRepository implements OfferDraftRepository {
  constructor(private readonly database: PgPool) {}

  findAggregate(
    scope: TenantScope,
    draftId: EntityId,
  ): Promise<OfferDraftAggregate | null> {
    return findAggregate(this.database, scope, draftId);
  }

  async create(
    scope: TenantScope,
    draft: OfferDraft,
    revision: OfferDraftRevision,
  ): Promise<OfferDraftAggregate> {
    invariant(
      draft.organisationId === scope.organisationId &&
        revision.organisationId === scope.organisationId,
      "TENANT_MISMATCH",
      "Draft creation must use the authenticated organisation scope.",
    );
    assertRevisionIntegrity(draft, revision);

    return withTransaction(this.database, async (client) => {
      await client.query(
        `INSERT INTO offer_drafts (
          organisation_id, id, project_id, state, current_revision,
          approved_revision, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          draft.organisationId,
          draft.id,
          draft.projectId,
          draft.state,
          draft.currentRevision,
          draft.approvedRevision ?? null,
          draft.createdAt,
          draft.updatedAt,
          draft.version,
        ],
      );
      await insertRevision(client, revision);
      const saved = await findAggregate(client, scope, draft.id);
      invariant(
        saved !== null,
        "INVALID_REVISION",
        "Created draft was not found.",
      );
      return saved;
    });
  }

  async saveCommercialEdit(
    scope: TenantScope,
    expectedVersion: number,
    edit: Parameters<OfferDraftRepository["saveCommercialEdit"]>[2],
  ): Promise<OfferDraftAggregate> {
    invariant(
      edit.draft.organisationId === scope.organisationId &&
        edit.revision.organisationId === scope.organisationId,
      "TENANT_MISMATCH",
      "Commercial edit must use the authenticated organisation scope.",
    );
    assertRevisionIntegrity(edit.draft, edit.revision);

    return withTransaction(this.database, async (client) => {
      const locked = await client.query<DraftRow>(
        `SELECT * FROM offer_drafts
         WHERE organisation_id = $1 AND id = $2 FOR UPDATE`,
        [scope.organisationId, edit.draft.id],
      );
      const persisted = locked.rows[0];
      if (persisted === undefined) {
        throw new DomainInvariantError(
          "FORBIDDEN_OR_NOT_FOUND",
          "Draft was not found in the authenticated organisation.",
        );
      }
      assertExpectedVersion(persisted.version, expectedVersion);
      invariant(
        edit.draft.version === expectedVersion + 1 &&
          edit.draft.currentRevision === persisted.current_revision + 1,
        "INVALID_REVISION",
        "Commercial edit result does not advance version and revision exactly once.",
      );

      await insertRevision(client, edit.revision);
      const updated = await client.query(
        `UPDATE offer_drafts
         SET state = $3, current_revision = $4, approved_revision = NULL,
             updated_at = $5, version = $6
         WHERE organisation_id = $1 AND id = $2 AND version = $7`,
        [
          scope.organisationId,
          edit.draft.id,
          edit.draft.state,
          edit.draft.currentRevision,
          edit.draft.updatedAt,
          edit.draft.version,
          expectedVersion,
        ],
      );
      invariant(
        updated.rowCount === 1,
        "VERSION_CONFLICT",
        "Draft changed while the commercial revision was being saved.",
      );
      const saved = await findAggregate(client, scope, edit.draft.id);
      invariant(
        saved !== null,
        "INVALID_REVISION",
        "Edited draft was not found.",
      );
      return saved;
    });
  }

  async saveApproval(
    scope: TenantScope,
    expectedVersion: number,
    approved: Parameters<OfferDraftRepository["saveApproval"]>[2],
  ): Promise<OfferDraftAggregate> {
    invariant(
      approved.draft.organisationId === scope.organisationId &&
        approved.approval.organisationId === scope.organisationId,
      "TENANT_MISMATCH",
      "Approval must use the authenticated organisation scope.",
    );

    return withTransaction(this.database, async (client) => {
      const locked = await client.query<DraftRow>(
        `SELECT * FROM offer_drafts
         WHERE organisation_id = $1 AND id = $2 FOR UPDATE`,
        [scope.organisationId, approved.draft.id],
      );
      const persisted = locked.rows[0];
      if (persisted === undefined) {
        throw new DomainInvariantError(
          "FORBIDDEN_OR_NOT_FOUND",
          "Draft was not found in the authenticated organisation.",
        );
      }
      assertExpectedVersion(persisted.version, expectedVersion);

      const approval = approved.approval;
      await client.query(
        `INSERT INTO human_approvals (
          organisation_id, id, offer_draft_id, revision, approved_by_user_id,
          confirmation_text, approved_at, invalidated_at, invalidation_reason,
          created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, $9, $10)`,
        [
          approval.organisationId,
          approval.id,
          approval.offerDraftId,
          approval.revision,
          approval.approvedByUserId,
          approval.confirmationText,
          approval.approvedAt,
          approval.createdAt,
          approval.updatedAt,
          approval.version,
        ],
      );
      const updated = await client.query(
        `UPDATE offer_drafts
         SET state = 'APPROVED', approved_revision = current_revision,
             updated_at = $3, version = $4
         WHERE organisation_id = $1 AND id = $2 AND version = $5`,
        [
          scope.organisationId,
          approved.draft.id,
          approved.draft.updatedAt,
          approved.draft.version,
          expectedVersion,
        ],
      );
      invariant(
        updated.rowCount === 1,
        "VERSION_CONFLICT",
        "Draft changed while approval was being saved.",
      );
      const saved = await findAggregate(client, scope, approved.draft.id);
      invariant(
        saved !== null,
        "INVALID_APPROVAL",
        "Approved draft was not found.",
      );
      return saved;
    });
  }

  async markExported(
    scope: TenantScope,
    expectedVersion: number,
    draft: OfferDraft,
  ): Promise<OfferDraftAggregate> {
    invariant(
      draft.organisationId === scope.organisationId,
      "TENANT_MISMATCH",
      "Export transition must use the authenticated organisation scope.",
    );
    return withTransaction(this.database, async (client) => {
      const updated = await client.query(
        `UPDATE offer_drafts
         SET state = 'EXPORTED', approved_revision = current_revision,
             updated_at = $3, version = $4
         WHERE organisation_id = $1 AND id = $2 AND version = $5`,
        [
          scope.organisationId,
          draft.id,
          draft.updatedAt,
          draft.version,
          expectedVersion,
        ],
      );
      invariant(
        updated.rowCount === 1,
        "VERSION_CONFLICT",
        "Draft changed before export state was persisted.",
      );
      const saved = await findAggregate(client, scope, draft.id);
      invariant(
        saved !== null,
        "INVALID_REVISION",
        "Exported draft was not found.",
      );
      return saved;
    });
  }
}

export class PostgresDeletionRepository implements DeletionRepository {
  constructor(private readonly database: PgPool) {}

  async createRequest(
    scope: TenantScope,
    request: DeletionRequest,
  ): Promise<DeletionRequest> {
    invariant(
      request.organisationId === scope.organisationId,
      "TENANT_MISMATCH",
      "Deletion request must use the authenticated organisation scope.",
    );
    const result = await this.database.query<DeletionRow>(
      `INSERT INTO deletion_requests (
        organisation_id, id, project_id, requested_by_user_id, status,
        consequence_acknowledged, created_at, updated_at, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        request.organisationId,
        request.id,
        request.projectId,
        request.requestedByUserId,
        request.status,
        request.consequenceAcknowledged,
        request.createdAt,
        request.updatedAt,
        request.version,
      ],
    );
    const row = result.rows[0];
    invariant(
      row !== undefined,
      "DELETION_NOT_ALLOWED",
      "Deletion request was not stored.",
    );
    return mapDeletionRequest(row);
  }

  async confirmRequest(
    scope: TenantScope,
    requestId: EntityId,
    expectedVersion: number,
    now: IsoDateTime,
  ): Promise<DeletionRequest> {
    return withTransaction(this.database, async (client) => {
      const result = await client.query<DeletionRow>(
        `SELECT * FROM deletion_requests
         WHERE organisation_id = $1 AND id = $2 FOR UPDATE`,
        [scope.organisationId, requestId],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new DomainInvariantError(
          "FORBIDDEN_OR_NOT_FOUND",
          "Deletion request was not found in the authenticated organisation.",
        );
      }
      const confirmed = confirmProjectDeletion(
        mapDeletionRequest(row),
        expectedVersion,
        true,
        now,
      );
      const updated = await client.query<DeletionRow>(
        `UPDATE deletion_requests
         SET status = 'CONFIRMED', consequence_acknowledged = true,
             updated_at = $3, version = $4
         WHERE organisation_id = $1 AND id = $2 AND version = $5
         RETURNING *`,
        [
          scope.organisationId,
          requestId,
          now,
          confirmed.version,
          expectedVersion,
        ],
      );
      const updatedRow = updated.rows[0];
      invariant(
        updatedRow !== undefined,
        "VERSION_CONFLICT",
        "Deletion request changed while confirmation was being saved.",
      );
      return mapDeletionRequest(updatedRow);
    });
  }

  async completeDemoDeletion(
    scope: TenantScope,
    requestId: EntityId,
    expectedVersion: number,
    actorUserId: UserId,
    now: IsoDateTime,
  ): Promise<DemoDeletionResult> {
    return withTransaction(this.database, async (client) => {
      const membership = await client.query<{ present: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM memberships
          WHERE organisation_id = $1 AND user_id = $2 AND active
        ) AS present`,
        [scope.organisationId, actorUserId],
      );
      invariant(
        membership.rows[0]?.present,
        "FORBIDDEN_OR_NOT_FOUND",
        "Deletion actor was not found in the authenticated organisation.",
      );

      const result = await client.query<DeletionRow>(
        `SELECT * FROM deletion_requests
         WHERE organisation_id = $1 AND id = $2 FOR UPDATE`,
        [scope.organisationId, requestId],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new DomainInvariantError(
          "FORBIDDEN_OR_NOT_FOUND",
          "Deletion request was not found in the authenticated organisation.",
        );
      }
      const request = mapDeletionRequest(row);
      completeProjectDeletion(request, expectedVersion, true, now);

      const objectKeys = await client.query<{ object_key: string }>(
        `SELECT asset.object_key
         FROM evidence_assets asset
         JOIN site_visits visit
           ON visit.organisation_id = asset.organisation_id
          AND visit.id = asset.site_visit_id
         WHERE visit.organisation_id = $1 AND visit.project_id = $2
         ORDER BY asset.object_key`,
        [scope.organisationId, request.projectId],
      );
      const counts = await client.query<{ counts: Record<string, number> }>(
        `SELECT jsonb_build_object(
          'projects', 1,
          'siteVisits', (SELECT count(*) FROM site_visits WHERE organisation_id = $1 AND project_id = $2),
          'evidenceAssets', (
            SELECT count(*) FROM evidence_assets asset
            JOIN site_visits visit ON visit.organisation_id = asset.organisation_id AND visit.id = asset.site_visit_id
            WHERE visit.organisation_id = $1 AND visit.project_id = $2
          ),
          'offerDrafts', (SELECT count(*) FROM offer_drafts WHERE organisation_id = $1 AND project_id = $2),
          'auditEvents', (SELECT count(*) FROM audit_events WHERE organisation_id = $1 AND project_id = $2)
        ) AS counts`,
        [scope.organisationId, request.projectId],
      );

      const deleted = await client.query(
        "DELETE FROM projects WHERE organisation_id = $1 AND id = $2",
        [scope.organisationId, request.projectId],
      );
      invariant(
        deleted.rowCount === 1,
        "FORBIDDEN_OR_NOT_FOUND",
        "Project was not found in the authenticated organisation.",
      );
      await client.query(
        `INSERT INTO deletion_receipts (
          organisation_id, request_id, completed_at, record_counts, purge_after
        ) VALUES ($1, $2, $3, $4::jsonb, ($3::timestamptz AT TIME ZONE 'UTC')::date + 30)`,
        [
          scope.organisationId,
          requestId,
          now,
          JSON.stringify(counts.rows[0]?.counts ?? {}),
        ],
      );

      return {
        requestId,
        completedAt: now,
        objectKeysToDelete: objectKeys.rows.map(({ object_key }) => object_key),
      };
    });
  }
}

export async function countOpenBlockingQuestions(
  database: PgQueryable,
  scope: TenantScope,
  projectId: EntityId,
): Promise<number> {
  const result = await database.query<{ count: number | string }>(
    `SELECT count(*) AS count FROM clarification_questions
     WHERE organisation_id = $1 AND project_id = $2
       AND blocking AND status <> 'ANSWERED'`,
    [scope.organisationId, projectId],
  );
  return integer(result.rows[0]?.count ?? 0);
}

export type { ClarificationQuestion };

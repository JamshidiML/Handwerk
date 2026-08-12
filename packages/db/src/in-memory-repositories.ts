import type {
  Customer,
  DeletionRequest,
  EntityId,
  IsoDateTime,
  Membership,
  OfferDraft,
  OfferDraftRevision,
  PriceBook,
  PriceBookItem,
  Project,
  SiteVisit,
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

function scopedKey(scope: TenantScope, id: EntityId | UserId): string {
  return `${scope.organisationId}\u0000${id}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryCustomerProjectRepository
  implements CustomerProjectRepository
{
  private readonly customers = new Map<string, Customer>();
  private readonly projects = new Map<string, Project>();
  private readonly siteVisits = new Map<string, SiteVisit>();

  constructor(
    input: {
      customers?: readonly Customer[];
      projects?: readonly Project[];
      siteVisits?: readonly SiteVisit[];
    } = {},
  ) {
    for (const customer of input.customers ?? []) {
      this.customers.set(
        scopedKey({ organisationId: customer.organisationId }, customer.id),
        clone(customer),
      );
    }
    for (const project of input.projects ?? []) {
      this.projects.set(
        scopedKey({ organisationId: project.organisationId }, project.id),
        clone(project),
      );
    }
    for (const visit of input.siteVisits ?? []) {
      this.siteVisits.set(
        scopedKey({ organisationId: visit.organisationId }, visit.id),
        clone(visit),
      );
    }
  }

  async findCustomer(
    scope: TenantScope,
    id: EntityId,
  ): Promise<Customer | null> {
    const value = this.customers.get(scopedKey(scope, id));
    return value === undefined ? null : clone(value);
  }

  async findProject(scope: TenantScope, id: EntityId): Promise<Project | null> {
    const value = this.projects.get(scopedKey(scope, id));
    return value === undefined ? null : clone(value);
  }

  async findSiteVisit(
    scope: TenantScope,
    id: EntityId,
  ): Promise<SiteVisit | null> {
    const value = this.siteVisits.get(scopedKey(scope, id));
    return value === undefined ? null : clone(value);
  }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly memberships = new Map<string, Membership>();

  constructor(memberships: readonly Membership[]) {
    for (const membership of memberships) {
      this.memberships.set(
        scopedKey(
          { organisationId: membership.organisationId },
          membership.userId,
        ),
        clone(membership),
      );
    }
  }

  async findActiveMembership(
    scope: TenantScope,
    userId: UserId,
  ): Promise<Membership | null> {
    const value = this.memberships.get(scopedKey(scope, userId));
    return value === undefined || !value.active ? null : clone(value);
  }
}

export class InMemoryPriceBookRepository implements PriceBookRepository {
  private readonly books = new Map<string, PriceBook>();
  private readonly items = new Map<string, PriceBookItem>();

  constructor(books: readonly PriceBook[], items: readonly PriceBookItem[]) {
    for (const book of books) {
      this.books.set(
        scopedKey({ organisationId: book.organisationId }, book.id),
        clone(book),
      );
    }
    for (const item of items) {
      this.items.set(
        scopedKey({ organisationId: item.organisationId }, item.id),
        clone(item),
      );
    }
  }

  async findActiveItem(
    scope: TenantScope,
    itemId: EntityId,
    asOfDate: string,
  ): Promise<{ priceBook: PriceBook; item: PriceBookItem } | null> {
    const item = this.items.get(scopedKey(scope, itemId));
    if (
      item === undefined ||
      !item.active ||
      (item.validFrom !== undefined && item.validFrom > asOfDate) ||
      (item.validTo !== undefined && item.validTo < asOfDate)
    ) {
      return null;
    }
    const book = this.books.get(scopedKey(scope, item.priceBookId));
    return book === undefined || !book.active
      ? null
      : { priceBook: clone(book), item: clone(item) };
  }
}

export class InMemoryOfferDraftRepository implements OfferDraftRepository {
  private readonly aggregates = new Map<string, OfferDraftAggregate>();

  async findAggregate(
    scope: TenantScope,
    draftId: EntityId,
  ): Promise<OfferDraftAggregate | null> {
    const aggregate = this.aggregates.get(scopedKey(scope, draftId));
    return aggregate === undefined ? null : clone(aggregate);
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
    const key = scopedKey(scope, draft.id);
    invariant(
      !this.aggregates.has(key),
      "INVALID_REVISION",
      "Draft already exists.",
    );
    const aggregate = { draft: clone(draft), revision: clone(revision) };
    this.aggregates.set(key, aggregate);
    return clone(aggregate);
  }

  async saveCommercialEdit(
    scope: TenantScope,
    expectedVersion: number,
    edit: Parameters<OfferDraftRepository["saveCommercialEdit"]>[2],
  ): Promise<OfferDraftAggregate> {
    const key = scopedKey(scope, edit.draft.id);
    const current = this.aggregates.get(key);
    if (current === undefined) {
      throw new DomainInvariantError(
        "FORBIDDEN_OR_NOT_FOUND",
        "Draft was not found in the authenticated organisation.",
      );
    }
    assertExpectedVersion(current.draft.version, expectedVersion);
    assertRevisionIntegrity(edit.draft, edit.revision);
    invariant(
      edit.draft.organisationId === scope.organisationId &&
        edit.draft.version === expectedVersion + 1 &&
        edit.draft.currentRevision === current.draft.currentRevision + 1 &&
        edit.draft.approvedRevision === undefined,
      "INVALID_REVISION",
      "Commercial edit must advance once and clear current approval.",
    );
    const aggregate = {
      draft: clone(edit.draft),
      revision: clone(edit.revision),
    };
    this.aggregates.set(key, aggregate);
    return clone(aggregate);
  }

  async saveApproval(
    scope: TenantScope,
    expectedVersion: number,
    approved: Parameters<OfferDraftRepository["saveApproval"]>[2],
  ): Promise<OfferDraftAggregate> {
    const key = scopedKey(scope, approved.draft.id);
    const current = this.aggregates.get(key);
    if (current === undefined) {
      throw new DomainInvariantError(
        "FORBIDDEN_OR_NOT_FOUND",
        "Draft was not found in the authenticated organisation.",
      );
    }
    assertExpectedVersion(current.draft.version, expectedVersion);
    invariant(
      approved.draft.organisationId === scope.organisationId &&
        approved.draft.version === expectedVersion + 1,
      "INVALID_APPROVAL",
      "Approval result must advance the scoped draft exactly once.",
    );
    const aggregate = {
      draft: clone(approved.draft),
      revision: clone(current.revision),
      approval: clone(approved.approval),
    };
    this.aggregates.set(key, aggregate);
    return clone(aggregate);
  }

  async markExported(
    scope: TenantScope,
    expectedVersion: number,
    draft: OfferDraft,
  ): Promise<OfferDraftAggregate> {
    const key = scopedKey(scope, draft.id);
    const current = this.aggregates.get(key);
    if (current === undefined) {
      throw new DomainInvariantError(
        "FORBIDDEN_OR_NOT_FOUND",
        "Draft was not found in the authenticated organisation.",
      );
    }
    assertExpectedVersion(current.draft.version, expectedVersion);
    invariant(
      draft.organisationId === scope.organisationId &&
        draft.state === "EXPORTED" &&
        draft.version === expectedVersion + 1 &&
        current.approval !== undefined,
      "APPROVAL_REQUIRED",
      "Export state requires the active scoped approval.",
    );
    const aggregate = { ...current, draft: clone(draft) };
    this.aggregates.set(key, aggregate);
    return clone(aggregate);
  }
}

export class InMemoryDeletionRepository implements DeletionRepository {
  private readonly requests = new Map<string, DeletionRequest>();
  private readonly projectKeys = new Map<string, string[]>();
  private readonly activeMembers = new Set<string>();

  constructor(
    input: {
      projects?: ReadonlyArray<{
        organisationId: TenantScope["organisationId"];
        projectId: EntityId;
        objectKeys?: readonly string[];
      }>;
      memberships?: readonly Membership[];
    } = {},
  ) {
    for (const project of input.projects ?? []) {
      this.projectKeys.set(
        scopedKey(
          { organisationId: project.organisationId },
          project.projectId,
        ),
        [...(project.objectKeys ?? [])],
      );
    }
    for (const membership of input.memberships ?? []) {
      if (membership.active) {
        this.activeMembers.add(
          scopedKey(
            { organisationId: membership.organisationId },
            membership.userId,
          ),
        );
      }
    }
  }

  async createRequest(
    scope: TenantScope,
    request: DeletionRequest,
  ): Promise<DeletionRequest> {
    invariant(
      request.organisationId === scope.organisationId &&
        this.projectKeys.has(scopedKey(scope, request.projectId)),
      "FORBIDDEN_OR_NOT_FOUND",
      "Project was not found in the authenticated organisation.",
    );
    this.requests.set(scopedKey(scope, request.id), clone(request));
    return clone(request);
  }

  async confirmRequest(
    scope: TenantScope,
    requestId: EntityId,
    expectedVersion: number,
    now: IsoDateTime,
  ): Promise<DeletionRequest> {
    const key = scopedKey(scope, requestId);
    const request = this.requests.get(key);
    if (request === undefined) {
      throw new DomainInvariantError(
        "FORBIDDEN_OR_NOT_FOUND",
        "Deletion request was not found in the authenticated organisation.",
      );
    }
    const confirmed = confirmProjectDeletion(
      request,
      expectedVersion,
      true,
      now,
    );
    this.requests.set(key, confirmed);
    return clone(confirmed);
  }

  async completeDemoDeletion(
    scope: TenantScope,
    requestId: EntityId,
    expectedVersion: number,
    actorUserId: UserId,
    now: IsoDateTime,
  ): Promise<DemoDeletionResult> {
    invariant(
      this.activeMembers.has(scopedKey(scope, actorUserId)),
      "FORBIDDEN_OR_NOT_FOUND",
      "Deletion actor was not found in the authenticated organisation.",
    );
    const requestKey = scopedKey(scope, requestId);
    const request = this.requests.get(requestKey);
    if (request === undefined) {
      throw new DomainInvariantError(
        "FORBIDDEN_OR_NOT_FOUND",
        "Deletion request was not found in the authenticated organisation.",
      );
    }
    completeProjectDeletion(request, expectedVersion, true, now);
    const projectKey = scopedKey(scope, request.projectId);
    const objectKeysToDelete = this.projectKeys.get(projectKey) ?? [];
    this.projectKeys.delete(projectKey);
    this.requests.delete(requestKey);
    return {
      requestId,
      completedAt: now,
      objectKeysToDelete: [...objectKeysToDelete],
    };
  }
}

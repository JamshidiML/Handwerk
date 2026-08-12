import type {
  Customer,
  DeletionRequest,
  EntityId,
  HumanApproval,
  IsoDateTime,
  Membership,
  OfferDraft,
  OfferDraftRevision,
  OrganisationId,
  PriceBook,
  PriceBookItem,
  Project,
  SiteVisit,
  UserId,
} from "@handwerk/contracts";

import type { ApproveDraftResult, CommercialEditResult } from "./offer-draft";

export interface TenantScope {
  organisationId: OrganisationId;
}

export interface OfferDraftAggregate {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  approval?: HumanApproval;
}

export interface CustomerProjectRepository {
  findCustomer(scope: TenantScope, id: EntityId): Promise<Customer | null>;
  findProject(scope: TenantScope, id: EntityId): Promise<Project | null>;
  findSiteVisit(scope: TenantScope, id: EntityId): Promise<SiteVisit | null>;
}

export interface PriceBookRepository {
  findActiveItem(
    scope: TenantScope,
    itemId: EntityId,
    asOfDate: string,
  ): Promise<{ priceBook: PriceBook; item: PriceBookItem } | null>;
}

export interface OfferDraftRepository {
  findAggregate(
    scope: TenantScope,
    draftId: EntityId,
  ): Promise<OfferDraftAggregate | null>;
  create(
    scope: TenantScope,
    draft: OfferDraft,
    revision: OfferDraftRevision,
  ): Promise<OfferDraftAggregate>;
  saveCommercialEdit(
    scope: TenantScope,
    expectedVersion: number,
    edit: CommercialEditResult,
  ): Promise<OfferDraftAggregate>;
  saveApproval(
    scope: TenantScope,
    expectedVersion: number,
    approval: ApproveDraftResult,
  ): Promise<OfferDraftAggregate>;
  markExported(
    scope: TenantScope,
    expectedVersion: number,
    draft: OfferDraft,
  ): Promise<OfferDraftAggregate>;
}

export interface DemoDeletionResult {
  requestId: EntityId;
  completedAt: IsoDateTime;
  objectKeysToDelete: string[];
}

export interface DeletionRepository {
  createRequest(
    scope: TenantScope,
    request: DeletionRequest,
  ): Promise<DeletionRequest>;
  confirmRequest(
    scope: TenantScope,
    requestId: EntityId,
    expectedVersion: number,
    now: IsoDateTime,
  ): Promise<DeletionRequest>;
  completeDemoDeletion(
    scope: TenantScope,
    requestId: EntityId,
    expectedVersion: number,
    actorUserId: UserId,
    now: IsoDateTime,
  ): Promise<DemoDeletionResult>;
}

export interface MembershipRepository {
  findActiveMembership(
    scope: TenantScope,
    userId: UserId,
  ): Promise<Membership | null>;
}

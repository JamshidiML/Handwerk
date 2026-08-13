import {
  CANONICAL_IDS,
  type Customer,
  type EntityId,
  type IsoDateTime,
  type Organisation,
  type OrganisationId,
  type Project,
  type SiteVisit,
  type User,
} from "@handwerk/contracts";
import type { DemoWorkspace, ProjectSummary } from "./types";

const ORGANISATION_ID = CANONICAL_IDS.organisation;

const entityId = (value: string) => value as EntityId;
const isoDateTime = (value: string) => value as IsoDateTime;

function customer(
  id: EntityId,
  displayName: string,
  createdAt: string,
): Customer {
  return {
    id,
    organisationId: ORGANISATION_ID,
    displayName,
    synthetic: true,
    createdAt: isoDateTime(createdAt),
    updatedAt: isoDateTime(createdAt),
    version: 1,
  };
}

function project(
  id: EntityId,
  customerId: EntityId,
  name: string,
  locationLabel: string,
  createdAt: string,
): Project {
  return {
    id,
    organisationId: ORGANISATION_ID,
    customerId,
    name,
    locationLabel,
    synthetic: true,
    createdAt: isoDateTime(createdAt),
    updatedAt: isoDateTime(createdAt),
    version: 1,
  };
}

const organisation: Organisation = {
  id: ORGANISATION_ID as unknown as EntityId,
  name: "Malerbetrieb Westblick GmbH",
  locale: "de-DE",
  currency: "EUR",
  createdAt: isoDateTime("2026-08-01T08:00:00.000Z"),
  updatedAt: isoDateTime("2026-08-12T08:00:00.000Z"),
  version: 1,
};

const user: User = {
  id: CANONICAL_IDS.user,
  displayName: "Demo-Inhaber",
  synthetic: true,
};

const syntheticCustomer = customer(
  CANONICAL_IDS.customer,
  "Beispielkundin 01",
  "2026-08-10T09:15:00.000Z",
);

const livingRoom = project(
  CANONICAL_IDS.project,
  syntheticCustomer.id,
  "Wohnzimmer renovieren - Bochum",
  "Bochum-Wiemelhausen",
  "2026-08-10T09:20:00.000Z",
);

const activeVisit: SiteVisit = {
  id: CANONICAL_IDS.siteVisit,
  organisationId: ORGANISATION_ID,
  projectId: livingRoom.id,
  status: "OPEN",
  startedAt: isoDateTime("2026-08-12T07:18:00.000Z"),
  createdAt: isoDateTime("2026-08-12T07:18:00.000Z"),
  updatedAt: isoDateTime("2026-08-12T07:42:00.000Z"),
  version: 2,
};

const morgenrot = customer(
  entityId("customer-demo-morgenrot"),
  "Demo-Hausverwaltung Morgenrot",
  "2026-08-04T10:00:00.000Z",
);

const stairwell = project(
  entityId("project-demo-treppenhaus"),
  morgenrot.id,
  "Treppenhaus auffrischen",
  "Dortmund-Kreuzviertel",
  "2026-08-05T13:10:00.000Z",
);

const completedVisit: SiteVisit = {
  id: entityId("visit-demo-treppenhaus"),
  organisationId: ORGANISATION_ID,
  projectId: stairwell.id,
  status: "COMPLETE",
  startedAt: isoDateTime("2026-08-07T08:30:00.000Z"),
  completedAt: isoDateTime("2026-08-07T09:05:00.000Z"),
  createdAt: isoDateTime("2026-08-07T08:30:00.000Z"),
  updatedAt: isoDateTime("2026-08-11T14:20:00.000Z"),
  version: 2,
};

const atelier = customer(
  entityId("customer-demo-atelier"),
  "Demo-Atelier Lichtkante",
  "2026-08-11T11:00:00.000Z",
);

const canonicalSummary: ProjectSummary = {
  project: livingRoom,
  siteVisit: activeVisit,
  draftState: "NEEDS_CLARIFICATION",
  openQuestions: 2,
  latestActivityAt: "2026-08-12T07:42:00.000Z",
  latestActivity: "Baustellenbesuch pausiert",
};

const completedSummary: ProjectSummary = {
  project: stairwell,
  siteVisit: completedVisit,
  draftState: "EXPORTED",
  openQuestions: 0,
  latestActivityAt: "2026-08-11T14:20:00.000Z",
  latestActivity: "Angebot als PDF exportiert",
  approvedGross: { currency: "EUR", minor: 249186 },
};

export const DEMO_NOW = "2026-08-12T10:00:00.000Z";

export const INITIAL_DEMO_WORKSPACE: DemoWorkspace = {
  organisation,
  user,
  customers: [
    { customer: syntheticCustomer, projects: [canonicalSummary] },
    { customer: morgenrot, projects: [completedSummary] },
    { customer: atelier, projects: [] },
  ],
};

export function isCanonicalProject(projectId: string) {
  return projectId === CANONICAL_IDS.project;
}

export function asOrganisationId(value: string) {
  return value as OrganisationId;
}

export function asEntityId(value: string) {
  return value as EntityId;
}

export function asIsoDateTime(value: string) {
  return value as IsoDateTime;
}

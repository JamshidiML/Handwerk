import type {
  Customer,
  DraftState,
  Money,
  Organisation,
  Project,
  SiteVisit,
  User,
} from "@handwerk/contracts";

export interface ProjectSummary {
  project: Project;
  siteVisit?: SiteVisit;
  draftState: DraftState;
  openQuestions: number;
  latestActivityAt: string;
  latestActivity: string;
  approvedGross?: Money;
}

export interface CustomerSummary {
  customer: Customer;
  projects: ProjectSummary[];
}

export interface DemoWorkspace {
  organisation: Organisation;
  user: User;
  customers: CustomerSummary[];
}

export interface NewProjectInput {
  customerId: string;
  name: string;
  locationLabel: string;
}

export interface DemoDataContextValue extends DemoWorkspace {
  createCustomer: (displayName: string) => Customer;
  createProject: (input: NewProjectInput) => Project;
  findProject: (projectId: string) => ProjectSummary | undefined;
  findCustomer: (customerId: string) => CustomerSummary | undefined;
  deleteDemoProject: (projectId: string) => boolean;
  removeProject: (projectId: string) => boolean;
  startSiteVisit: (projectId: string) => SiteVisit | undefined;
}

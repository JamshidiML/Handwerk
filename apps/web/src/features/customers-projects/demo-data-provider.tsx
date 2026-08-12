"use client";

import type { Customer, Project, SiteVisit } from "@handwerk/contracts";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  asEntityId,
  asIsoDateTime,
  asOrganisationId,
  INITIAL_DEMO_WORKSPACE,
  isCanonicalProject,
} from "./demo-data";
import type {
  DemoDataContextValue,
  DemoWorkspace,
  NewProjectInput,
} from "./types";

const DemoDataContext = createContext<DemoDataContextValue | null>(null);

function demoId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return asEntityId(`${prefix}-${suffix}`);
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<DemoWorkspace>(
    INITIAL_DEMO_WORKSPACE,
  );

  const value = useMemo<DemoDataContextValue>(() => {
    const findCustomer = (customerId: string) =>
      workspace.customers.find(({ customer }) => customer.id === customerId);

    const findProject = (projectId: string) =>
      workspace.customers
        .flatMap(({ projects }) => projects)
        .find(({ project }) => project.id === projectId);

    const createCustomer = (displayName: string): Customer => {
      const now = new Date().toISOString();
      const created: Customer = {
        id: demoId("customer-demo"),
        organisationId: asOrganisationId(workspace.organisation.id),
        displayName: displayName.trim(),
        synthetic: true,
        createdAt: asIsoDateTime(now),
        updatedAt: asIsoDateTime(now),
        version: 1,
      };
      setWorkspace((current) => ({
        ...current,
        customers: [...current.customers, { customer: created, projects: [] }],
      }));
      return created;
    };

    const createProject = (input: NewProjectInput): Project => {
      const now = new Date().toISOString();
      const created: Project = {
        id: demoId("project-demo"),
        organisationId: asOrganisationId(workspace.organisation.id),
        customerId: asEntityId(input.customerId),
        name: input.name.trim(),
        locationLabel: input.locationLabel.trim(),
        synthetic: true,
        createdAt: asIsoDateTime(now),
        updatedAt: asIsoDateTime(now),
        version: 1,
      };
      setWorkspace((current) => ({
        ...current,
        customers: current.customers.map((entry) =>
          entry.customer.id === input.customerId
            ? {
                ...entry,
                projects: [
                  ...entry.projects,
                  {
                    project: created,
                    draftState: "CAPTURING",
                    openQuestions: 0,
                    latestActivityAt: now,
                    latestActivity: "Projekt angelegt",
                  },
                ],
              }
            : entry,
        ),
      }));
      return created;
    };

    const deleteDemoProject = (projectId: string) => {
      const exists = workspace.customers.some((entry) =>
        entry.projects.some(({ project }) => project.id === projectId),
      );
      if (!exists) return false;
      setWorkspace((current) => ({
        ...current,
        customers: current.customers.map((entry) => ({
          ...entry,
          projects: entry.projects.filter(
            ({ project }) => project.id !== projectId,
          ),
        })),
      }));
      return true;
    };

    const removeProject = (projectId: string) => {
      if (isCanonicalProject(projectId)) return false;
      return deleteDemoProject(projectId);
    };

    const startSiteVisit = (projectId: string): SiteVisit | undefined => {
      const currentProject = findProject(projectId);
      if (!currentProject) return undefined;
      if (currentProject.siteVisit?.status === "OPEN")
        return currentProject.siteVisit;

      const now = new Date().toISOString();
      const visit: SiteVisit = {
        id: demoId("visit-demo"),
        organisationId: asOrganisationId(workspace.organisation.id),
        projectId: asEntityId(projectId),
        status: "OPEN",
        startedAt: asIsoDateTime(now),
        createdAt: asIsoDateTime(now),
        updatedAt: asIsoDateTime(now),
        version: 1,
      };
      setWorkspace((current) => ({
        ...current,
        customers: current.customers.map((entry) => ({
          ...entry,
          projects: entry.projects.map((summary) =>
            summary.project.id === projectId
              ? {
                  ...summary,
                  siteVisit: visit,
                  draftState: "CAPTURING",
                  latestActivityAt: now,
                  latestActivity: "Baustellenbesuch gestartet",
                }
              : summary,
          ),
        })),
      }));
      return visit;
    };

    return {
      ...workspace,
      createCustomer,
      createProject,
      findProject,
      findCustomer,
      deleteDemoProject,
      removeProject,
      startSiteVisit,
    };
  }, [workspace]);

  return (
    <DemoDataContext.Provider value={value}>
      {children}
    </DemoDataContext.Provider>
  );
}

export function useDemoData() {
  const value = useContext(DemoDataContext);
  if (!value)
    throw new Error("useDemoData must be used inside DemoDataProvider");
  return value;
}

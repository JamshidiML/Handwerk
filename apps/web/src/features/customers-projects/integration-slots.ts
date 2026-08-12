import type { Organisation, Project, SiteVisit } from "@handwerk/contracts";
import type { ComponentType } from "react";

export interface ProjectFeatureSlotProps {
  organisation: Organisation;
  project: Project;
  siteVisit?: SiteVisit;
  demoMode: true;
}

export interface ProjectFeatureSlots {
  Capture?: ComponentType<ProjectFeatureSlotProps>;
  Clarifications?: ComponentType<ProjectFeatureSlotProps>;
  OfferReview?: ComponentType<ProjectFeatureSlotProps>;
  Privacy?: ComponentType<ProjectFeatureSlotProps>;
}

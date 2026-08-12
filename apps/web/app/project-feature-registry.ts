import type { ProjectFeatureSlots } from "@/src/features/customers-projects/integration-slots";
import {
  CaptureWorkflowFeature,
  ClarificationWorkflowFeature,
  OfferWorkflowFeature,
  PrivacyWorkflowFeature,
} from "@/src/features/integration/project-workflow";

export const projectFeatureSlots: ProjectFeatureSlots = {
  Capture: CaptureWorkflowFeature,
  Clarifications: ClarificationWorkflowFeature,
  OfferReview: OfferWorkflowFeature,
  Privacy: PrivacyWorkflowFeature,
};

import type { Metadata } from "next";
import { projectFeatureSlots } from "@/app/project-feature-registry";
import { ProjectOverview } from "@/src/features/customers-projects/project-overview";

export const metadata: Metadata = {
  title: "Projekt",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <ProjectOverview
      ClarificationsFeature={projectFeatureSlots.Clarifications}
      OfferReviewFeature={projectFeatureSlots.OfferReview}
      PrivacyFeature={projectFeatureSlots.Privacy}
      projectId={projectId}
    />
  );
}

import type { Metadata } from "next";
import { projectFeatureSlots } from "@/app/project-feature-registry";
import { SiteVisitWorkspace } from "@/src/features/customers-projects/site-visit-workspace";

export const metadata: Metadata = {
  title: "Baustellenbesuch",
};

export default async function SiteVisitPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SiteVisitWorkspace
      CaptureFeature={projectFeatureSlots.Capture}
      projectId={projectId}
    />
  );
}

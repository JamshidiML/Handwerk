import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OfferReview } from "./OfferReview";
import { createSyntheticReviewInput } from "./test-fixture";

describe("OfferReview", () => {
  it("renders detailed commercial, provenance, excluded, and unmatched information", () => {
    const input = createSyntheticReviewInput();
    const html = renderToStaticMarkup(
      <OfferReview
        draft={input.draft}
        revision={input.revision}
        approval={input.approval}
        unresolvedCriticalQuestionCount={0}
        onQuantityCommit={vi.fn()}
        onApprove={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(html).toContain("Aktuelle Revision freigegeben");
    expect(html).toContain("WB-001");
    expect(html).toContain("Einheitspreis");
    expect(html).toContain("Warum diese Position?");
    expect(html).toContain(
      "Explizit eingegebene und bestätigte synthetische Messung",
    );
    expect(html).toContain("Deckenfläche 20 m²");
    expect(html).toContain("Beschädigte Sockelleiste");
    expect(html).toContain("PDF herunterladen");
    expect(html).not.toContain('disabled=""');
  });

  it("shows stale approval semantics and disabled export controls", () => {
    const input = createSyntheticReviewInput();
    const html = renderToStaticMarkup(
      <OfferReview
        draft={input.draft}
        revision={input.revision}
        approval={{ ...input.approval!, revision: 2 }}
        unresolvedCriticalQuestionCount={0}
        onQuantityCommit={vi.fn()}
        onApprove={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(html).toContain("Freigabe veraltet");
    expect(html).toContain("Die Freigabe gehört zu einer älteren Revision.");
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(3);
  });
});

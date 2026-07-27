import { FinancialEventsReview } from "@/components/account/financial-events-review";
import { requireFounderReviewUser } from "@/lib/founder-review-auth";
import { loadFinancialEventReviewQueue } from "@/lib/financial-event-review-server";

export const dynamic = "force-dynamic";

export default async function FinancialEventsReviewPage() {
  const user = await requireFounderReviewUser();
  const cards = await loadFinancialEventReviewQueue(user.id);
  return <FinancialEventsReview cards={cards} />;
}

import { FinancialEventsReview } from "@/components/account/financial-events-review";
import { requireFounderReviewUser } from "@/lib/founder-review-auth";
import { loadFinancialEventReviewQueue } from "@/lib/financial-event-review-server";
import {
  parseFinancialPeriodSelection,
  resolveFinancialPeriod,
} from "@/lib/financial-periods";

export const dynamic = "force-dynamic";

export default async function FinancialEventsReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireFounderReviewUser();
  const period = resolveFinancialPeriod(
    parseFinancialPeriodSelection(await searchParams),
  );
  const cards = await loadFinancialEventReviewQueue(user.id, period);
  return <FinancialEventsReview cards={cards} period={period} />;
}

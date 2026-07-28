import { requireFounderReviewUser } from "@/lib/founder-review-auth";
import { TransactionUnderstandingPreview } from "@/components/account/transaction-understanding-preview";

export const dynamic = "force-dynamic";

export default async function TransactionUnderstandingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const localCapture =
    process.env.NODE_ENV === "development" &&
    params.capture === "founder-preview";
  if (!localCapture) await requireFounderReviewUser();
  return <TransactionUnderstandingPreview />;
}

import { PageLayout } from "@/components/layout/page-layout";
import { DiscoveryCard, FinancialStoryCard, FirstWinCard, NextBestMoveCard } from "./first-win-cards";

export function FirstWinExperience() {
  return (
    <PageLayout className="py-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 py-8 sm:gap-9 sm:py-12">
        <FirstWinCard />
        <DiscoveryCard />
        <NextBestMoveCard />
        <FinancialStoryCard />
      </div>
    </PageLayout>
  );
}

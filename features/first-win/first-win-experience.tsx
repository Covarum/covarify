import { PageLayout } from "@/components/layout/page-layout";
import { DiscoveryCard, FinancialStoryCard, FirstWinCard, OpportunityCard } from "./first-win-cards";

export function FirstWinExperience() {
  return (
    <PageLayout className="py-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-8 sm:gap-7 sm:py-12">
        <FirstWinCard />
        <DiscoveryCard />
        <OpportunityCard />
        <FinancialStoryCard />
      </div>
    </PageLayout>
  );
}

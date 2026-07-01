import Link from "next/link";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  sampleDocuments,
  sampleFinancialEvents,
  samplePeople,
  sampleTransactions,
} from "@/features/financial-brain/sample-data";
import { classifyLifeBucket, groupTransactionsByEvent, shouldShowMoneyByDefault } from "./classifiers";
import { formatEventAmount, generateSampleDiscovery, getEventSummary } from "./summaries";

export function FinancialBrainPreview() {
  const groupedEvents = groupTransactionsByEvent(sampleTransactions, sampleFinancialEvents);
  const discovery = generateSampleDiscovery(sampleFinancialEvents, sampleTransactions);

  return (
    <PageLayout className="py-8 sm:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-[#7c5cff]">Internal preview</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight text-[#16131d] sm:text-6xl">
              Financial Brain Foundation
            </h1>
            <p className="mt-5 text-lg leading-8 text-[#5f586b]">
              Sample data only. This preview verifies how Covarify groups transactions into Financial Events and decides when
              money should be visible by default.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/first-win">Back to First Win</Link>
          </Button>
        </div>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
          <div className="space-y-5">
            {groupedEvents.map(({ event, transactions }) => {
              const documents = sampleDocuments.filter((document) => event.documentIds.includes(document.id));
              const summary = getEventSummary(event, sampleTransactions, sampleDocuments);
              const people = event.people
                .map((personId) => samplePeople.find((person) => person.id === personId)?.name)
                .filter(Boolean);

              return (
                <Card key={event.id} className="p-6 sm:p-7">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-[#7c5cff]">
                        Financial Event &gt; Transaction
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold text-[#16131d]">{event.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[#5f586b]">{event.purpose}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f7f3ff] px-4 py-3 text-sm font-semibold text-[#4d31c7]">
                      Money {shouldShowMoneyByDefault(event) ? "shown" : "hidden"} by default
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <PreviewStat label="Life Bucket" value={event.lifeBucket} />
                    <PreviewStat label="Amount View" value={formatEventAmount(summary)} />
                    <PreviewStat label="Transactions" value={String(summary.transactionCount)} />
                    <PreviewStat label="Documents" value={String(summary.documentCount)} />
                  </div>

                  <p className="mt-5 rounded-2xl border border-[#eee7f5] bg-[#fbfaf8] p-4 text-sm leading-6 text-[#5f586b]">
                    {summary.contextLine}
                  </p>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#262036]">Linked transactions</h3>
                      <div className="mt-3 space-y-3">
                        {transactions.map((transaction) => (
                          <div key={transaction.id} className="rounded-2xl border border-[#eee7f5] bg-white/72 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-[#262036]">{transaction.merchant}</p>
                                <p className="mt-1 text-xs leading-5 text-[#726b7c]">{transaction.rawDescription}</p>
                              </div>
                              <span className="text-sm font-semibold text-[#262036]">${transaction.amount.toFixed(2)}</span>
                            </div>
                            <p className="mt-3 text-xs font-semibold text-[#7c5cff]">
                              Rule bucket: {classifyLifeBucket(transaction)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#262036]">Context records</h3>
                      <div className="mt-3 space-y-3">
                        {documents.length > 0 ? (
                          documents.map((document) => (
                            <div key={document.id} className="rounded-2xl border border-[#eee7f5] bg-white/72 p-4">
                              <p className="text-sm font-semibold text-[#262036]">{document.title}</p>
                              <p className="mt-1 text-xs leading-5 text-[#726b7c]">{document.retentionReason}</p>
                              <p className="mt-3 text-xs font-semibold text-[#7c5cff]">{document.type}</p>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-2xl border border-[#eee7f5] bg-white/72 p-4 text-sm leading-6 text-[#726b7c]">
                            No sample documents linked yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {people.length > 0 ? (
                    <p className="mt-5 text-sm leading-6 text-[#5f586b]">People connected to this event: {people.join(", ")}</p>
                  ) : null}
                </Card>
              );
            })}
          </div>

          <aside className="space-y-5">
            <Card className="p-6 sm:p-7">
              <p className="text-sm font-semibold text-[#7c5cff]">Sample discovery</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#16131d]">{discovery.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#5f586b]">{discovery.description}</p>
              <div className="mt-5 space-y-3">
                {discovery.evidence.map((item) => (
                  <p key={item} className="rounded-2xl bg-[#fbfaf8] p-4 text-sm leading-6 text-[#5f586b]">
                    {item}
                  </p>
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-normal text-[#726b7c]">
                Confidence: {discovery.confidence}
              </p>
            </Card>

            {discovery.nextBestMove ? (
              <Card className="p-6 sm:p-7">
                <p className="text-sm font-semibold text-[#7c5cff]">Sample next best move</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#16131d]">{discovery.nextBestMove.title}</h2>
                <p className="mt-4 text-sm leading-6 text-[#5f586b]">{discovery.nextBestMove.description}</p>
                <div className="mt-5 rounded-2xl bg-[#f7f3ff] p-4 text-sm font-semibold text-[#4d31c7]">
                  {discovery.nextBestMove.actionLabel}
                </div>
                <p className="mt-4 text-xs leading-5 text-[#726b7c]">{discovery.nextBestMove.disclaimer}</p>
              </Card>
            ) : null}
          </aside>
        </section>
      </div>
    </PageLayout>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eee7f5] bg-white/72 p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-[#726b7c]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#262036]">{value}</p>
    </div>
  );
}

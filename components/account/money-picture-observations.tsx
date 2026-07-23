"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

import type {
  InsightCandidate,
  IntelligenceResult,
} from "@/lib/money-picture-intelligence";
import styles from "./money-picture-observations.module.css";

type MoneyPictureObservationsProps = {
  intelligence: Pick<
    IntelligenceResult,
    "observations" | "criticalAlert" | "stableMessage" | "dataQualityStatus"
  >;
};

function ObservationCard({
  observation,
  dismiss,
}: {
  observation: InsightCandidate;
  dismiss: (observationId: string) => void;
}) {
  return (
    <article
      className={styles.card}
      aria-labelledby={`${observation.observationId}-title`}
    >
      <button
        className={styles.dismiss}
        type="button"
        onClick={() => dismiss(observation.observationId)}
        aria-label={`Dismiss ${observation.title} for this session`}
      >
        <X size={15} aria-hidden="true" />
      </button>
      <p className={styles.period}>{observation.period}</p>
      <h3 id={`${observation.observationId}-title`}>{observation.title}</h3>
      <p className={styles.observed}>{observation.observed}</p>
      <p className={styles.meaning}>{observation.meaning}</p>
      <p className={styles.support}>{observation.support}</p>
      <p className={styles.question}>
        <strong>Ask Covarify:</strong> <span>{observation.question}</span>
      </p>
    </article>
  );
}

export function MoneyPictureObservations({
  intelligence,
}: MoneyPictureObservationsProps) {
  const initial = [
    ...(intelligence.criticalAlert ? [intelligence.criticalAlert] : []),
    ...intelligence.observations,
  ];
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const visible = initial.filter(
    (observation) => !dismissed.has(observation.observationId),
  );
  const dismiss = (observationId: string) =>
    setDismissed((current) => new Set(current).add(observationId));

  return (
    <section
      className={styles.section}
      aria-labelledby="money-picture-observations-heading"
    >
      <div className={styles.heading}>
        <div>
          <p>
            <Sparkles size={14} aria-hidden="true" />
            Explainable observations
          </p>
          <h2 id="money-picture-observations-heading">What matters today</h2>
        </div>
        <span>Based on connected account activity</span>
      </div>

      {visible.length > 0 ? (
        <div className={styles.grid}>
          {visible.map((observation) => (
            <ObservationCard
              key={observation.observationId}
              observation={observation}
              dismiss={dismiss}
            />
          ))}
        </div>
      ) : initial.length > 0 ? (
        <div className={styles.stable}>
          <h3>Observations dismissed for this session</h3>
          <p>They will return when you start a new session.</p>
        </div>
      ) : (
        <div className={styles.stable}>
          <h3>Your financial picture is stable today</h3>
          <p>
            No meaningful changes were detected based on your connected account
            activity.
          </p>
        </div>
      )}

      {intelligence.dataQualityStatus && (
        <aside className={styles.dataQuality}>
          <strong>{intelligence.dataQualityStatus.title}</strong>
          <span>{intelligence.dataQualityStatus.body}</span>
        </aside>
      )}
    </section>
  );
}

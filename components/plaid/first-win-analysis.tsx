import { ArrowRight, Check, TrendingDown } from "lucide-react";

type SpendGroup = { category?: string; merchant?: string; amount: number; transaction_count: number };
export type FirstWinAnalysisData = {
  cash_flow_summary: { total_inflows: number; total_outflows: number; net_cash_flow: number; cash_gap: number; analysis_window_label: string; transaction_count_used: number };
  spending_classification: { essential_spend: number; flexible_spend: number; debt_payment_spend: number; unknown_spend: number; top_flexible_categories: SpendGroup[]; top_merchants: SpendGroup[]; largest_outflows: { merchant: string; amount: number; category: string; date: string }[] };
  savings_levers: { category: string; current_30_day_spend: number; suggested_reduction: string; estimated_savings: number; reasoning: string }[];
  deficit_repair: null | { summary: string; comparison: string; fallback: string | null; weekly_improvement_needed: number };
  recommendation: { headline: string; diagnosis: string; why_this_matters: string; suggested_next_action: string; estimated_impact: string; next_7_days: string[]; watch_out: string; confidence_level: string; disclaimer: string };
};

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function FirstWinAnalysis({ analysis }: { analysis: FirstWinAnalysisData }) {
  const cash = analysis.cash_flow_summary;
  const spend = analysis.spending_classification;
  return <section className="first-win-engine">
    <div className="first-win-title"><span className="success-icon"><Check /></span><div><p className="eyebrow plain">First Win Engine v0</p><h2>{analysis.recommendation.headline}</h2><p>{analysis.recommendation.diagnosis}</p></div><span className="confidence">{analysis.recommendation.confidence_level} confidence</span></div>

    <div className="analysis-block"><div className="analysis-heading"><p className="eyebrow plain">What Covarify sees</p><span>{cash.analysis_window_label}</span></div><div className="analysis-metrics"><article><span>Inflows</span><strong className="positive">+{money(cash.total_inflows)}</strong></article><article><span>Outflows</span><strong>−{money(cash.total_outflows)}</strong></article><article><span>Net cash flow</span><strong className={cash.net_cash_flow >= 0 ? "positive" : "negative"}>{cash.net_cash_flow >= 0 ? "+" : "−"}{money(Math.abs(cash.net_cash_flow))}</strong></article>{cash.cash_gap > 0 && <article><span>Cash gap</span><strong className="negative">{money(cash.cash_gap)}</strong></article>}<article><span>Transactions analyzed</span><strong>{cash.transaction_count_used}</strong></article></div></div>

    <div className="analysis-block"><p className="eyebrow plain">Where the pressure is coming from</p><div className="pressure-grid"><article><h3>Flexible categories</h3>{spend.top_flexible_categories.slice(0, 4).map((item) => <div className="rank-row" key={item.category}><span>{item.category}</span><b>{money(item.amount)}</b><small>{item.transaction_count} transactions</small></div>)}</article><article><h3>Top merchants</h3>{spend.top_merchants.slice(0, 4).map((item) => <div className="rank-row" key={item.merchant}><span>{item.merchant}</span><b>{money(item.amount)}</b><small>{item.transaction_count} transactions</small></div>)}</article><article><h3>Largest outflows</h3>{spend.largest_outflows.slice(0, 4).map((item, index) => <div className="rank-row" key={`${item.merchant}-${index}`}><span>{item.merchant}</span><b>−{money(item.amount)}</b><small>{item.category}</small></div>)}</article></div></div>

    <div className="analysis-block"><p className="eyebrow plain">Where you could get back ahead</p><div className="lever-grid">{analysis.savings_levers.length ? analysis.savings_levers.map((lever) => <article key={lever.category}><div><h3>{lever.category}</h3><span>{money(lever.current_30_day_spend)} current spend</span></div><strong>{money(lever.estimated_savings)} <small>estimated savings</small></strong><p>Reduce by {lever.suggested_reduction}. {lever.reasoning}</p></article>) : <p className="empty-analysis">Covarify would look for more categorized flexible spending before suggesting a savings target.</p>}</div></div>

    {analysis.deficit_repair && <div className="repair-card"><TrendingDown size={21} /><div><p className="eyebrow plain">Deficit repair plan</p><h3>{analysis.deficit_repair.summary}</h3><p>{analysis.deficit_repair.comparison}</p>{analysis.deficit_repair.fallback && <p className="repair-note">{analysis.deficit_repair.fallback}</p>}</div></div>}

    <div className="recommendation-card"><p className="eyebrow plain">Your First Win</p><h2>{analysis.recommendation.headline}</h2><p>{analysis.recommendation.why_this_matters}</p><div className="next-action"><ArrowRight size={18} /><div><strong>Suggested next action</strong><p>{analysis.recommendation.suggested_next_action}</p></div></div><p className="impact"><strong>Estimated impact</strong>{analysis.recommendation.estimated_impact}</p><div className="seven-days"><strong>Next 7 days</strong>{analysis.recommendation.next_7_days.map((item) => <span key={item}><Check size={14} />{item}</span>)}</div><p className="watch-out"><strong>Keep in view:</strong> {analysis.recommendation.watch_out}</p><small>{analysis.recommendation.disclaimer}</small></div>
  </section>;
}

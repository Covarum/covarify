import type { CanonicalFinancialTruth } from "./financial-truth.ts";
import type { CanonicalDecisionResult, CapabilityId, FinancialEntityType } from "./turn-contract.ts";
export type ResolvedSemanticRequest = { capability: CapabilityId; statement: string; entityIds: string[] };
export type DomainAdapterContext = { sessionId: string; recentEntityIds: string[] };
export type DomainAdapter = { id: "TRANSACTION_UNDERSTANDING" | "ALLOCATION" | "EXPECTED_RESOURCE" | "GOAL_STRATEGY" | "SNAPSHOT_COMPARISON"; capabilities: CapabilityId[]; entityTypes: FinancialEntityType[]; execute: (truth: CanonicalFinancialTruth, request: ResolvedSemanticRequest, context: DomainAdapterContext) => CanonicalDecisionResult };

import { RoleLevel } from '@lms/contracts';

/** Requirements are versioned DATA, not code (ADR-006). */
export type Requirement = { id: string; label: string; weight: number } & (
  | { kind: 'course'; courseId: string }
  | { kind: 'assessment'; assessmentId: string }
  | { kind: 'certification'; certificationName: string }
  | { kind: 'evidence'; requirementKey: string }
  | { kind: 'tenure'; months: number }
);

export type RequirementSetStatus = 'draft' | 'active' | 'superseded';

export interface RequirementSet {
  id: string;
  /** Lineage key: versions of the same transition share it. */
  lineageId: string;
  fromRoleLevel: RoleLevel;
  toRoleLevel: RoleLevel;
  version: number;
  status: RequirementSetStatus;
  effectiveFrom: string;
  requirements: Requirement[];
}

export type FactKind =
  | 'course-completed'
  | 'assessment-passed'
  | 'certification-earned'
  | 'evidence-approved';

/** Append-only fact in Promotion's own ledger — never a join into other schemas. */
export interface LedgerFact {
  factId: string;
  userId: string;
  kind: FactKind;
  /** courseId | assessmentId | certification name | evidence requirementKey. */
  refId: string;
  sourceEventId: string;
  occurredAt: string;
}

export interface RequirementResult {
  requirementId: string;
  kind: Requirement['kind'];
  label: string;
  weight: number;
  satisfied: boolean;
}

export interface ReadinessResult {
  percentReady: number;
  satisfied: RequirementResult[];
  missing: RequirementResult[];
}

/**
 * Weight-normalized readiness: 100 * Σ(weight of satisfied) / Σ(weight of all).
 * Pure function — the heart of the core domain, exhaustively unit-tested.
 */
export function computeReadiness(
  set: RequirementSet,
  facts: LedgerFact[],
  tenure: { currentLevelSince: string | null; now: Date },
): ReadinessResult {
  const results: RequirementResult[] = set.requirements.map((req) => ({
    requirementId: req.id,
    kind: req.kind,
    label: req.label,
    weight: req.weight,
    satisfied: isSatisfied(req, facts, tenure),
  }));
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const satisfiedWeight = results.filter((r) => r.satisfied).reduce((sum, r) => sum + r.weight, 0);
  return {
    percentReady: totalWeight === 0 ? 0 : Math.round((satisfiedWeight / totalWeight) * 100),
    satisfied: results.filter((r) => r.satisfied),
    missing: results.filter((r) => !r.satisfied),
  };
}

function isSatisfied(
  req: Requirement,
  facts: LedgerFact[],
  tenure: { currentLevelSince: string | null; now: Date },
): boolean {
  switch (req.kind) {
    case 'course':
      return facts.some((f) => f.kind === 'course-completed' && f.refId === req.courseId);
    case 'assessment':
      return facts.some((f) => f.kind === 'assessment-passed' && f.refId === req.assessmentId);
    case 'certification':
      return facts.some((f) => f.kind === 'certification-earned' && f.refId === req.certificationName);
    case 'evidence':
      return facts.some((f) => f.kind === 'evidence-approved' && f.refId === req.requirementKey);
    case 'tenure': {
      if (!tenure.currentLevelSince) return false;
      const since = new Date(tenure.currentLevelSince);
      const months =
        (tenure.now.getTime() - since.getTime()) / (30.4375 * 86_400_000);
      return months >= req.months;
    }
  }
}

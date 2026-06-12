import { EventPayload } from '@lms/contracts';
import { ClockPort, IdPort } from '../../ports/system.port';
import { EventSubscriber } from '../shared-kernel/event-bus';
import { FactKind } from './domain/requirement-set';
import { CompletionLedger } from './promotion.repositories';
import { RecalculateReadinessService } from './features/recalculate-readiness';

/**
 * Ledger ingestion: each upstream achievement becomes an append-only fact (idempotent on
 * the event id), then readiness is recalculated. JobLevelChanged re-targets the active set.
 */
export function promotionSubscriber(
  ledger: CompletionLedger,
  recalc: RecalculateReadinessService,
  clock: ClockPort,
  ids: IdPort,
): EventSubscriber {
  return {
    name: 'promotion.ledger-ingestion',
    eventTypes: [
      'CourseCompleted',
      'AssessmentPassed',
      'CertificationEarned',
      'EvidenceApproved',
      'JobLevelChanged',
    ],
    handle(event) {
      let userId: string;
      let ingest: { kind: FactKind; refId: string } | null = null;
      switch (event.type) {
        case 'CourseCompleted': {
          const p = event.payload as EventPayload<'CourseCompleted'>;
          userId = p.userId;
          ingest = { kind: 'course-completed', refId: p.courseId };
          break;
        }
        case 'AssessmentPassed': {
          const p = event.payload as EventPayload<'AssessmentPassed'>;
          userId = p.userId;
          ingest = { kind: 'assessment-passed', refId: p.assessmentId };
          break;
        }
        case 'CertificationEarned': {
          const p = event.payload as EventPayload<'CertificationEarned'>;
          userId = p.userId;
          // certification requirements match by NAME (external certs have no internal ref)
          ingest = { kind: 'certification-earned', refId: p.name };
          break;
        }
        case 'EvidenceApproved': {
          const p = event.payload as EventPayload<'EvidenceApproved'>;
          userId = p.userId;
          if (!p.targetRequirementId) return; // untargeted evidence does not feed readiness
          ingest = { kind: 'evidence-approved', refId: p.targetRequirementId };
          break;
        }
        case 'JobLevelChanged': {
          userId = (event.payload as EventPayload<'JobLevelChanged'>).userId;
          break; // no fact — just re-target and recalculate
        }
        default:
          return;
      }
      if (ingest) {
        const appended = ledger.append({
          factId: ids.next(),
          userId,
          kind: ingest.kind,
          refId: ingest.refId,
          sourceEventId: event.id,
          occurredAt: clock.now().toISOString(),
        });
        if (!appended) return; // replayed event — ledger already has the fact
      }
      recalc.recalculate(userId);
    },
  };
}

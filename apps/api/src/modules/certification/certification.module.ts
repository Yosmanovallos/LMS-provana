import { CertificationSource, EventPayload } from '@lms/contracts';
import { ClockPort, IdPort } from '../../ports/system.port';
import { AuthenticatedUser } from '../../ports/auth.port';
import { EventSubscriber, InProcessEventBus } from '../shared-kernel/event-bus';
import { DomainEventPublisher } from '../shared-kernel/publisher';
import { Result, err, ok } from '../shared-kernel/result';
import { AggregateRoot } from '../shared-kernel/aggregate-root';

export type CertificationStatus = 'valid' | 'expired' | 'revoked';

export class Certification extends AggregateRoot {
  status: CertificationStatus = 'valid';

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly type: 'internal' | 'external',
    public readonly source: CertificationSource,
    public readonly sourceRefId: string | null,
    public readonly issuedAt: string,
    public readonly expiresAt: string | null,
    public readonly verificationRef: string | null = null,
  ) {
    super();
    this.recordEvent('CertificationEarned', this.id, {
      certificationId: this.id,
      userId: this.userId,
      name: this.name,
      source: this.source,
      ...(this.sourceRefId ? { sourceRefId: this.sourceRefId } : {}),
    });
  }

  expire(): boolean {
    if (this.status !== 'valid') return false;
    this.status = 'expired';
    this.recordEvent('CertificationExpired', this.id, {
      certificationId: this.id,
      userId: this.userId,
      name: this.name,
    });
    return true;
  }
}

export interface CertificationRepository {
  byId(id: string): Certification | null;
  byUser(userId: string): Certification[];
  bySourceRef(userId: string, source: CertificationSource, sourceRefId: string): Certification | null;
  list(): Certification[];
  save(cert: Certification): void;
}

export class InMemoryCertificationRepository implements CertificationRepository {
  private items = new Map<string, Certification>();
  byId(id: string) {
    return this.items.get(id) ?? null;
  }
  byUser(userId: string) {
    return [...this.items.values()].filter((c) => c.userId === userId);
  }
  bySourceRef(userId: string, source: CertificationSource, sourceRefId: string) {
    return (
      [...this.items.values()].find(
        (c) => c.userId === userId && c.source === source && c.sourceRefId === sourceRefId,
      ) ?? null
    );
  }
  list() {
    return [...this.items.values()];
  }
  save(cert: Certification) {
    this.items.set(cert.id, cert);
  }
}

/** Admin config: which assessments/courses/evidence-requirements certify, by name. */
export class CertifyingConfig {
  readonly assessments = new Map<string, { name: string; validMonths?: number }>();
  readonly courses = new Map<string, { name: string; validMonths?: number }>();
  readonly evidenceRequirements = new Map<string, { name: string; validMonths?: number }>();
}

export class CertificationService {
  constructor(
    private readonly repo: CertificationRepository,
    private readonly config: CertifyingConfig,
    private readonly publisher: DomainEventPublisher,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
  ) {}

  /** Idempotent per (userId, source, sourceRefId). */
  issue(
    userId: string,
    name: string,
    type: 'internal' | 'external',
    source: CertificationSource,
    sourceRefId: string | null,
    validMonths?: number,
    verificationRef?: string,
  ): Certification | null {
    if (sourceRefId && this.repo.bySourceRef(userId, source, sourceRefId)) return null;
    const issuedAt = this.clock.now();
    const expiresAt = validMonths
      ? new Date(issuedAt.getTime() + validMonths * 30 * 86_400_000).toISOString()
      : null;
    const cert = new Certification(
      this.ids.next(),
      userId,
      name,
      type,
      source,
      sourceRefId,
      issuedAt.toISOString(),
      expiresAt,
      verificationRef ?? null,
    );
    this.repo.save(cert);
    this.publisher.publishFrom('certification', cert);
    return cert;
  }

  /** Expiry job: transitions due certs exactly once. */
  expireDue(): number {
    const now = this.clock.now().toISOString();
    let count = 0;
    for (const cert of this.repo.list()) {
      if (cert.status === 'valid' && cert.expiresAt && cert.expiresAt <= now && cert.expire()) {
        this.repo.save(cert);
        this.publisher.publishFrom('certification', cert);
        count += 1;
      }
    }
    return count;
  }
}

export class IssueManualCertificationHandler {
  constructor(private readonly service: CertificationService) {}

  execute(
    input: { userId: string; name: string; type?: 'internal' | 'external'; validMonths?: number; verificationRef?: string },
    actor: AuthenticatedUser,
  ): Result<{ certificationId: string }> {
    if (actor.role !== 'admin') return err('forbidden', 'cert.manage requires admin');
    const cert = this.service.issue(
      input.userId,
      input.name,
      input.type ?? 'external',
      'manual',
      null,
      input.validMonths,
      input.verificationRef,
    );
    if (!cert) return err('conflict', 'Certification already issued');
    return ok({ certificationId: cert.id });
  }
}

export class CertificationQueries {
  constructor(private readonly repo: CertificationRepository) {}

  listForUser(userId: string) {
    return this.repo.byUser(userId).map(view);
  }
  registry() {
    return this.repo.list().map(view);
  }
  /** Valid certification names per user — consumed by promotion via injected function. */
  validNamesOf(userId: string): string[] {
    return this.repo
      .byUser(userId)
      .filter((c) => c.status === 'valid')
      .map((c) => c.name);
  }
}

function view(c: Certification) {
  return {
    certificationId: c.id,
    userId: c.userId,
    name: c.name,
    type: c.type,
    source: c.source,
    status: c.status,
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
  };
}

function eventSubscribers(service: CertificationService, config: CertifyingConfig): EventSubscriber[] {
  return [
    {
      name: 'certification.on-assessment-passed',
      eventTypes: ['AssessmentPassed'],
      handle(event) {
        const p = event.payload as EventPayload<'AssessmentPassed'>;
        const cfg = config.assessments.get(p.assessmentId);
        if (cfg) service.issue(p.userId, cfg.name, 'internal', 'assessment', p.assessmentId, cfg.validMonths);
      },
    },
    {
      name: 'certification.on-course-completed',
      eventTypes: ['CourseCompleted'],
      handle(event) {
        const p = event.payload as EventPayload<'CourseCompleted'>;
        const cfg = config.courses.get(p.courseId);
        if (cfg) service.issue(p.userId, cfg.name, 'internal', 'course', p.courseId, cfg.validMonths);
      },
    },
    {
      name: 'certification.on-evidence-approved',
      eventTypes: ['EvidenceApproved'],
      handle(event) {
        const p = event.payload as EventPayload<'EvidenceApproved'>;
        if (!p.targetRequirementId) return;
        const cfg = config.evidenceRequirements.get(p.targetRequirementId);
        if (cfg) service.issue(p.userId, cfg.name, 'external', 'evidence', p.evidenceId, cfg.validMonths);
      },
    },
  ];
}

export interface CertificationModule {
  service: CertificationService;
  issueManual: IssueManualCertificationHandler;
  queries: CertificationQueries;
  config: CertifyingConfig;
}

export function createCertificationModule(deps: {
  publisher: DomainEventPublisher;
  bus: InProcessEventBus;
  clock: ClockPort;
  ids: IdPort;
}): CertificationModule {
  const repo = new InMemoryCertificationRepository();
  const config = new CertifyingConfig();
  const service = new CertificationService(repo, config, deps.publisher, deps.clock, deps.ids);
  for (const sub of eventSubscribers(service, config)) deps.bus.subscribe(sub);
  return {
    service,
    issueManual: new IssueManualCertificationHandler(service),
    queries: new CertificationQueries(repo),
    config,
  };
}

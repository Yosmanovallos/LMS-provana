import { unwrap } from '../modules/shared-kernel/result';
import { Container } from '../container';

export interface SeedResult {
  personas: { userId: string; role: string; displayName: string }[];
  courseIds: Record<string, string>;
  assessmentIds: Record<string, string>;
}

/**
 * Demo scenario (master plan §14/§7.7): three personas, QA Junior→Mid path and
 * requirement set, Ana sitting at 82% readiness with named gaps.
 */
export function seedDemoData(c: Container): SeedResult {
  const admin = { userId: '', role: 'admin' as const };
  const register = (email: string, displayName: string, role?: 'employee' | 'manager' | 'admin') =>
    unwrap(c.identity.registerUser.execute({ externalAuthId: `dev|${email}`, email, displayName, role })).userId;

  // personas
  const alex = register('alex.admin@provana.dev', 'Alex Admin', 'admin');
  admin.userId = alex;
  const marco = register('marco.manager@provana.dev', 'Marco Manager', 'manager');
  const ana = register('ana.qa@provana.dev', 'Ana Quintero');
  const ben = register('ben.dev@provana.dev', 'Ben Dervis');

  unwrap(c.organization.assignManager.execute({ userId: ana, managerId: marco }, admin));
  unwrap(c.organization.assignManager.execute({ userId: ben, managerId: marco }, admin));
  unwrap(c.organization.changeJobLevel.execute({ userId: ana, jobRoleId: 'qa', jobLevelId: 'junior' }, admin));
  unwrap(c.organization.changeJobLevel.execute({ userId: ben, jobRoleId: 'dev', jobLevelId: 'mid' }, admin));

  // catalog
  const course = (title: string, lessons: string[]) =>
    unwrap(
      c.learning.authorCatalog.createCourse(
        {
          title,
          modules: [
            { title: 'Module 1', lessons: lessons.map((t) => ({ title: t, type: 'video' as const, durationMin: 15 })) },
          ],
        },
        admin,
      ),
    ).courseId;
  const testing = course('Testing Fundamentals', ['Intro', 'Test design', 'Reporting']);
  const agile = course('Agile Basics', ['Scrum', 'Kanban']);
  const automation = course('Automation Fundamentals', ['Selenium', 'API testing', 'CI pipelines']);
  for (const id of [testing, agile, automation]) {
    unwrap(c.learning.authorCatalog.publishCourse(id, admin));
  }

  // assessments
  const theory = unwrap(
    c.assessment.author.create(
      {
        title: 'QA Theory Assessment',
        questions: [
          { kind: 'multiple-choice', prompt: 'Which is a test design technique?', options: ['Boundary value analysis', 'Pair programming', 'Standup'], correctIndexes: [0], points: 10 },
          { kind: 'multiple-choice', prompt: 'Regression testing verifies…', options: ['New features only', 'Existing behavior still works', 'UI colors'], correctIndexes: [1], points: 10 },
        ],
        passingScorePct: 70,
        maxAttempts: 3,
      },
      admin,
    ),
  ).assessmentId;
  const assessmentA = unwrap(
    c.assessment.author.create(
      {
        title: 'Assessment A (Practical Automation)',
        questions: [
          { kind: 'multiple-choice', prompt: 'Best locator strategy?', options: ['xpath always', 'role-based', 'sleep'], correctIndexes: [1], points: 10 },
          { kind: 'practical', prompt: 'Automate the login flow and attach the repo link.', points: 20 },
        ],
        passingScorePct: 70,
        maxAttempts: 3,
      },
      admin,
    ),
  ).assessmentId;
  unwrap(c.assessment.author.publish(theory, admin));
  unwrap(c.assessment.author.publish(assessmentA, admin));

  // study path targeting QA Junior (auto-enrolled via JobLevelChanged is in the past;
  // enroll Ana explicitly for the demo)
  const { pathId } = unwrap(
    c.learning.authorCatalog.createPath(
      {
        title: 'QA Junior → Mid Path',
        targetRoleLevel: { jobRoleId: 'qa', jobLevelId: 'junior' },
        items: [
          { kind: 'course', refId: testing },
          { kind: 'course', refId: agile },
          { kind: 'course', refId: automation },
          { kind: 'assessment', refId: theory },
        ],
      },
      admin,
    ),
  );
  unwrap(c.learning.authorCatalog.publishPath(pathId, admin));

  // requirement set: the 82% scenario weights
  const { requirementSetId } = unwrap(
    c.promotion.manageSets.create(
      {
        fromRoleLevel: { jobRoleId: 'qa', jobLevelId: 'junior' },
        toRoleLevel: { jobRoleId: 'qa', jobLevelId: 'mid' },
        requirements: [
          { kind: 'course', courseId: testing, label: 'Testing Fundamentals', weight: 10 },
          { kind: 'course', courseId: agile, label: 'Agile Basics', weight: 10 },
          { kind: 'course', courseId: automation, label: 'Automation Fundamentals', weight: 6 },
          { kind: 'assessment', assessmentId: assessmentA, label: 'Assessment A', weight: 8 },
          { kind: 'assessment', assessmentId: theory, label: 'QA Theory Assessment', weight: 30 },
          { kind: 'certification', certificationName: 'Certification B', label: 'Certification B', weight: 4 },
          { kind: 'evidence', requirementKey: 'req-project-evidence', label: 'Project Evidence', weight: 32 },
        ],
      },
      admin,
    ),
  );
  unwrap(c.promotion.manageSets.activate(requirementSetId, admin));

  // Ana's progress: completes Testing Fundamentals + Agile Basics, passes theory,
  // gets project evidence approved → 82% ready, missing Automation/Assessment A/Cert B.
  const anaActor = { userId: ana, role: 'employee' as const };
  unwrap(c.learning.enrollUser.execute({ userId: ana, targetKind: 'path', targetId: pathId }, { userId: marco, role: 'manager' }));
  for (const courseId of [testing, agile]) {
    const { enrollmentId } = unwrap(
      c.learning.enrollUser.execute({ userId: ana, targetKind: 'course', targetId: courseId }, anaActor),
    );
    for (const lessonId of c.learning.queries.getCourse(courseId)!.lessonIds()) {
      unwrap(c.learning.completeLesson.execute({ enrollmentId, lessonId }, anaActor));
    }
  }
  // enroll (not complete) automation so it shows in Active
  unwrap(c.learning.enrollUser.execute({ userId: ana, targetKind: 'course', targetId: automation }, anaActor));

  const { attemptId } = unwrap(c.assessment.startAttempt.execute({ assessmentId: theory }, anaActor));
  const theoryQuestions = c.assessment.queries.getAssessment(theory)!.questions;
  unwrap(
    c.assessment.submitAttempt.execute(
      {
        attemptId,
        answers: [
          { questionId: theoryQuestions[0]!.id, value: [0] },
          { questionId: theoryQuestions[1]!.id, value: [1] },
        ],
      },
      anaActor,
    ),
  );

  const { evidenceId } = unwrap(
    c.evidence.submit.execute(
      {
        file: { fileName: 'project-evidence.pdf', mime: 'application/pdf', sizeBytes: 120_000, content: 'demo' },
        description: 'E2E automation project for the billing squad',
        targetRequirementId: 'req-project-evidence',
      },
      anaActor,
    ),
  );
  unwrap(c.evidence.review.startReview({ evidenceId }, { userId: marco, role: 'manager' }));
  unwrap(c.evidence.review.approve({ evidenceId, note: 'Solid work' }, { userId: marco, role: 'manager' }));

  // a pending evidence item so Marco's queue is not empty
  unwrap(
    c.evidence.submit.execute(
      {
        file: { fileName: 'cert-scan.png', mime: 'image/png', sizeBytes: 80_000, content: 'scan' },
        description: 'Scrum certificate scan',
      },
      anaActor,
    ),
  );

  c.gamification.leaderboards.materialize();

  return {
    personas: [
      { userId: alex, role: 'admin', displayName: 'Alex Admin' },
      { userId: marco, role: 'manager', displayName: 'Marco Manager' },
      { userId: ana, role: 'employee', displayName: 'Ana Quintero' },
      { userId: ben, role: 'employee', displayName: 'Ben Dervis' },
    ],
    courseIds: { testing, agile, automation },
    assessmentIds: { theory, assessmentA },
  };
}

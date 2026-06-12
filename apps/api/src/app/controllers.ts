import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeaderboardPeriod } from '@lms/contracts';
import { Container } from '../container';
import { SeedResult } from './seed';
import { AuthedRequest, CONTAINER, actorOf, respond } from './http';

export const SEED_INFO = 'LMS_SEED_INFO';

@ApiTags('system')
@Controller()
export class SystemController {
  constructor(
    @Inject(CONTAINER) private readonly c: Container,
    @Inject(SEED_INFO) private readonly seed: SeedResult | null,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', outboxPending: this.c.outbox.pending().length };
  }

  /** Dev persona switcher source (AUTH_MODE=dev only). */
  @Get('dev/personas')
  personas() {
    return this.seed?.personas ?? [];
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    const actor = actorOf(req);
    return {
      ...actor,
      user: this.c.identity.queries.getUser(actor.userId),
      profile: this.c.organization.queries.getProfile(actor.userId),
      unreadNotifications: this.c.notification.service.unreadCount(actor.userId),
    };
  }
}

@ApiTags('identity')
@Controller('users')
export class IdentityController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    const actor = actorOf(req);
    if (actor.role !== 'admin' && actor.role !== 'manager') return [];
    return this.c.identity.queries.listUsers();
  }

  @Post()
  register(@Body() body: { externalAuthId: string; email: string; displayName: string; role?: 'employee' | 'manager' | 'admin' }) {
    return respond(this.c.identity.registerUser.execute(body));
  }

  @Post(':id/role')
  assignRole(@Param('id') id: string, @Body() body: { role: 'employee' | 'manager' | 'admin' }, @Req() req: AuthedRequest) {
    return respond(this.c.identity.assignRole.execute({ userId: id, role: body.role }, actorOf(req)));
  }
}

@ApiTags('organization')
@Controller('org')
export class OrganizationController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get('profiles/:id')
  profile(@Param('id') id: string) {
    return this.c.organization.queries.getProfile(id);
  }

  @Get('team')
  team(@Req() req: AuthedRequest) {
    return this.c.organization.queries.getTeamMembers(actorOf(req).userId);
  }

  @Get('taxonomy')
  taxonomy() {
    return this.c.organization.queries.listRoleLevels();
  }

  @Post('profiles/:id/manager')
  assignManager(@Param('id') id: string, @Body() body: { managerId: string }, @Req() req: AuthedRequest) {
    return respond(this.c.organization.assignManager.execute({ userId: id, managerId: body.managerId }, actorOf(req)));
  }

  @Post('profiles/:id/job-level')
  changeJobLevel(@Param('id') id: string, @Body() body: { jobRoleId: string; jobLevelId: string }, @Req() req: AuthedRequest) {
    return respond(this.c.organization.changeJobLevel.execute({ userId: id, ...body }, actorOf(req)));
  }
}

@ApiTags('learning')
@Controller()
export class LearningController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get('catalog')
  catalog(@Req() req: AuthedRequest) {
    return actorOf(req).role === 'admin'
      ? this.c.learning.queries.listAllCatalog()
      : this.c.learning.queries.listPublishedCatalog();
  }

  @Get('catalog/courses/:id')
  course(@Param('id') id: string) {
    return this.c.learning.queries.getCourse(id);
  }

  @Post('catalog/courses')
  createCourse(@Body() body: Parameters<Container['learning']['authorCatalog']['createCourse']>[0], @Req() req: AuthedRequest) {
    return respond(this.c.learning.authorCatalog.createCourse(body, actorOf(req)));
  }

  @Post('catalog/courses/:id/publish')
  publishCourse(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.learning.authorCatalog.publishCourse(id, actorOf(req)));
  }

  @Post('catalog/paths')
  createPath(@Body() body: Parameters<Container['learning']['authorCatalog']['createPath']>[0], @Req() req: AuthedRequest) {
    return respond(this.c.learning.authorCatalog.createPath(body, actorOf(req)));
  }

  @Post('catalog/paths/:id/publish')
  publishPath(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.learning.authorCatalog.publishPath(id, actorOf(req)));
  }

  @Post('catalog/programs')
  createProgram(@Body() body: Parameters<Container['learning']['authorCatalog']['createProgram']>[0], @Req() req: AuthedRequest) {
    return respond(this.c.learning.authorCatalog.createProgram(body, actorOf(req)));
  }

  @Get('my-learning')
  myLearning(@Req() req: AuthedRequest) {
    return this.c.learning.queries.getMyLearning(actorOf(req).userId);
  }

  @Get('my-learning/enrollments')
  myEnrollments(@Req() req: AuthedRequest) {
    return this.c.learning.queries.userEnrollments(actorOf(req).userId);
  }

  @Post('enrollments')
  enroll(
    @Body() body: { userId?: string; targetKind: 'course' | 'program' | 'path' | 'assessment'; targetId: string; dueDate?: string },
    @Req() req: AuthedRequest,
  ) {
    const actor = actorOf(req);
    return respond(this.c.learning.enrollUser.execute({ ...body, userId: body.userId ?? actor.userId }, actor));
  }

  @Post('enrollments/:id/lessons/:lessonId/complete')
  completeLesson(@Param('id') id: string, @Param('lessonId') lessonId: string, @Req() req: AuthedRequest) {
    return respond(this.c.learning.completeLesson.execute({ enrollmentId: id, lessonId }, actorOf(req)));
  }
}

@ApiTags('assessment')
@Controller()
export class AssessmentController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get('assessments')
  list(@Req() req: AuthedRequest) {
    return actorOf(req).role === 'admin'
      ? this.c.assessment.queries.listAll()
      : this.c.assessment.queries.listPublished();
  }

  @Get('assessments/:id')
  get(@Param('id') id: string) {
    return this.c.assessment.queries.getAssessment(id);
  }

  @Post('assessments')
  create(@Body() body: Parameters<Container['assessment']['author']['create']>[0], @Req() req: AuthedRequest) {
    return respond(this.c.assessment.author.create(body, actorOf(req)));
  }

  @Post('assessments/:id/publish')
  publish(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.assessment.author.publish(id, actorOf(req)));
  }

  @Post('assessments/:id/attempts')
  start(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.assessment.startAttempt.execute({ assessmentId: id }, actorOf(req)));
  }

  @Post('attempts/:id/submit')
  submit(@Param('id') id: string, @Body() body: { answers: { questionId: string; value: number[] | string }[] }, @Req() req: AuthedRequest) {
    return respond(this.c.assessment.submitAttempt.execute({ attemptId: id, answers: body.answers }, actorOf(req)));
  }

  @Post('attempts/:id/review')
  review(
    @Param('id') id: string,
    @Body() body: { manualScores: { questionId: string; points: number }[]; feedback?: string },
    @Req() req: AuthedRequest,
  ) {
    return respond(this.c.assessment.reviewAttempt.execute({ attemptId: id, ...body }, actorOf(req)));
  }

  @Get('my/attempts')
  myAttempts(@Req() req: AuthedRequest) {
    return this.c.assessment.queries.attemptsOf(actorOf(req).userId);
  }

  @Get('review-queue/assessments')
  queue(@Req() req: AuthedRequest) {
    return this.c.assessment.queries.reviewQueue(actorOf(req));
  }
}

@ApiTags('evidence')
@Controller('evidence')
export class EvidenceController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post()
  submit(
    @Body() body: Parameters<Container['evidence']['submit']['execute']>[0],
    @Req() req: AuthedRequest,
  ) {
    return respond(this.c.evidence.submit.execute(body, actorOf(req)));
  }

  @Get('mine')
  mine(@Req() req: AuthedRequest) {
    return this.c.evidence.queries.listForUser(actorOf(req).userId);
  }

  @Get('review-queue')
  queue(@Req() req: AuthedRequest) {
    return this.c.evidence.queries.reviewQueue(actorOf(req));
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.evidence.queries.getItem(id, actorOf(req)));
  }

  @Post(':id/start-review')
  startReview(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.evidence.review.startReview({ evidenceId: id }, actorOf(req)));
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { note?: string }, @Req() req: AuthedRequest) {
    return respond(this.c.evidence.review.approve({ evidenceId: id, note: body?.note }, actorOf(req)));
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() body: { feedback: string }, @Req() req: AuthedRequest) {
    return respond(this.c.evidence.review.reject({ evidenceId: id, feedback: body?.feedback ?? '' }, actorOf(req)));
  }
}

@ApiTags('certification')
@Controller('certifications')
export class CertificationController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get('mine')
  mine(@Req() req: AuthedRequest) {
    return this.c.certification.queries.listForUser(actorOf(req).userId);
  }

  @Get('registry')
  registry(@Req() req: AuthedRequest) {
    const actor = actorOf(req);
    return actor.role === 'employee' ? [] : this.c.certification.queries.registry();
  }

  @Post('manual')
  manual(@Body() body: Parameters<Container['certification']['issueManual']['execute']>[0], @Req() req: AuthedRequest) {
    return respond(this.c.certification.issueManual.execute(body, actorOf(req)));
  }

  /** Expiry job endpoint (BullMQ slot post-MVP). */
  @Post('expire-due')
  expireDue(@Req() req: AuthedRequest) {
    if (actorOf(req).role !== 'admin') return { expired: 0 };
    return { expired: this.c.certification.service.expireDue() };
  }
}

@ApiTags('promotion')
@Controller()
export class PromotionController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get('requirement-sets')
  sets() {
    return this.c.promotion.queries.listRequirementSets();
  }

  @Post('requirement-sets')
  create(@Body() body: Parameters<Container['promotion']['manageSets']['create']>[0], @Req() req: AuthedRequest) {
    return respond(this.c.promotion.manageSets.create(body, actorOf(req)));
  }

  @Post('requirement-sets/:id/activate')
  activate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.promotion.manageSets.activate(id, actorOf(req)));
  }

  @Post('requirement-sets/:id/new-version')
  newVersion(
    @Param('id') id: string,
    @Body() body: { requirements: Parameters<Container['promotion']['manageSets']['newVersion']>[0]['requirements'] },
    @Req() req: AuthedRequest,
  ) {
    return respond(this.c.promotion.manageSets.newVersion({ requirementSetId: id, requirements: body.requirements }, actorOf(req)));
  }

  @Get('promotion/gap/:userId')
  gap(@Param('userId') userId: string, @Req() req: AuthedRequest) {
    return respond(this.c.promotion.queries.gapReport(userId, actorOf(req)));
  }

  @Get('promotion/team')
  team(@Req() req: AuthedRequest) {
    return respond(this.c.promotion.queries.teamReadiness(actorOf(req)));
  }
}

@ApiTags('gamification')
@Controller('gamification')
export class GamificationController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get('points/mine')
  points(@Req() req: AuthedRequest) {
    return this.c.gamification.queries.pointsOf(actorOf(req).userId);
  }

  @Get('achievements/mine')
  achievements(@Req() req: AuthedRequest) {
    return this.c.gamification.queries.achievementsOf(actorOf(req).userId);
  }

  @Get('leaderboard')
  leaderboard(
    @Query('period') period: LeaderboardPeriod = 'monthly',
    @Query('scope') scope: 'global' | 'team' = 'global',
    @Query('teamRef') teamRef?: string,
  ) {
    return this.c.gamification.queries.leaderboard(period, scope, teamRef);
  }

  @Post('recognize')
  recognize(@Body() body: { userId: string; note?: string }, @Req() req: AuthedRequest) {
    return respond(this.c.gamification.recognition.execute(body, actorOf(req)));
  }

  /** Materialization job endpoint (BullMQ slot post-MVP). */
  @Post('materialize-leaderboards')
  materialize() {
    this.c.gamification.leaderboards.materialize();
    return { ok: true };
  }

  @Put('rules/:ruleId')
  updateRule(@Param('ruleId') ruleId: string, @Body() body: { points: number; dailyCapPerUser?: number }, @Req() req: AuthedRequest) {
    if (actorOf(req).role !== 'admin') return { updated: false };
    return { updated: this.c.gamification.rules.update(ruleId, body.points, body.dailyCapPerUser) };
  }
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get('completion-rate')
  completionRate() {
    return this.c.analytics.projections.completionRateByTeam();
  }

  @Get('velocity')
  velocity() {
    return this.c.analytics.projections.learningVelocity();
  }

  @Get('active-learners')
  active() {
    return this.c.analytics.projections.activeLearners();
  }

  @Get('team-progress')
  teamProgress(@Req() req: AuthedRequest) {
    return this.c.analytics.projections.teamProgress(actorOf(req).userId);
  }

  @Get('readiness-distribution')
  readiness() {
    return this.c.analytics.projections.readinessDistribution();
  }

  @Post('rebuild')
  rebuild(@Req() req: AuthedRequest) {
    if (actorOf(req).role !== 'admin') return { rebuilt: false };
    this.c.analytics.rebuild();
    return { rebuilt: true };
  }
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get()
  inbox(@Req() req: AuthedRequest) {
    return this.c.notification.service.inboxOf(actorOf(req).userId);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthedRequest) {
    return respond(this.c.notification.service.markRead(actorOf(req).userId, id));
  }

  @Post('preferences')
  setPreference(@Body() body: { channel: 'email' | 'in-app'; enabled: boolean }, @Req() req: AuthedRequest) {
    this.c.notification.preferences.set(actorOf(req).userId, body.channel, body.enabled);
    return { ok: true };
  }

  @Get('audit/events')
  audit(@Req() req: AuthedRequest) {
    // append-only domain event log surfaced for the admin Audit view
    return actorOf(req).role === 'admin' ? this.c.outbox.all().slice(-200) : [];
  }
}

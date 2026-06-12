import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { buildContainer } from '../container';
import {
  AnalyticsController,
  AssessmentController,
  CertificationController,
  EvidenceController,
  GamificationController,
  IdentityController,
  LearningController,
  NotificationController,
  OrganizationController,
  PromotionController,
  SEED_INFO,
  SystemController,
} from './controllers';
import { AuthGuard, CONTAINER } from './http';
import { seedDemoData } from './seed';

const container = buildContainer();
const seedInfo = process.env.SEED === 'false' ? null : seedDemoData(container);

@Module({
  controllers: [
    SystemController,
    IdentityController,
    OrganizationController,
    LearningController,
    AssessmentController,
    EvidenceController,
    CertificationController,
    PromotionController,
    GamificationController,
    AnalyticsController,
    NotificationController,
  ],
  providers: [
    { provide: CONTAINER, useValue: container },
    { provide: SEED_INFO, useValue: seedInfo },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}

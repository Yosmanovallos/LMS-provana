import { EventPayload } from '@lms/contracts';
import { EventSubscriber } from '../shared-kernel/event-bus';
import { EmployeeProfile } from './domain/employee-profile';
import { ProfileRepository } from './organization.repositories';

/** Auto-create an empty profile for every registered user. */
export function profileSyncSubscriber(profiles: ProfileRepository): EventSubscriber {
  return {
    name: 'organization.profile-sync',
    eventTypes: ['UserRegistered'],
    handle(event) {
      const payload = event.payload as EventPayload<'UserRegistered'>;
      if (profiles.byUserId(payload.userId)) return; // idempotent
      profiles.save(new EmployeeProfile(payload.userId, payload.displayName));
    },
  };
}

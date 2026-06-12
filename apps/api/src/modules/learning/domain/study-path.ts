import { RoleLevel } from '@lms/contracts';
import { AggregateRoot } from '../../shared-kernel/aggregate-root';
import { Result, err, ok } from '../../shared-kernel/result';
import { CatalogStatus } from './course';

export interface PathItem {
  kind: 'course' | 'program' | 'assessment';
  refId: string;
}

/** Program: grouping of courses with schedule windows. */
export interface Program {
  id: string;
  title: string;
  courseIds: string[];
  startsAt?: string;
  endsAt?: string;
  status: CatalogStatus;
}

export class StudyPath extends AggregateRoot {
  status: CatalogStatus = 'draft';
  version = 1;

  constructor(
    public readonly id: string,
    public title: string,
    /** RoleLevel this path targets — drives auto-assignment. */
    public targetRoleLevel: RoleLevel,
    public items: PathItem[],
  ) {
    super();
  }

  publish(): Result<void> {
    if (this.status === 'archived') return err('invariant', 'Archived path cannot be published');
    if (this.items.length === 0) return err('validation', 'Path needs at least one item');
    this.status = 'published';
    return ok(undefined);
  }
}

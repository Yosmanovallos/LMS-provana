import { EvidenceItem } from './domain/evidence-item';

export interface EvidenceRepository {
  byId(id: string): EvidenceItem | null;
  byUser(userId: string): EvidenceItem[];
  pendingReview(): EvidenceItem[];
  save(item: EvidenceItem): void;
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private items = new Map<string, EvidenceItem>();

  byId(id: string) {
    return this.items.get(id) ?? null;
  }
  byUser(userId: string) {
    return [...this.items.values()].filter((e) => e.userId === userId);
  }
  pendingReview() {
    return [...this.items.values()].filter(
      (e) => e.status === 'submitted' || e.status === 'under-review',
    );
  }
  save(item: EvidenceItem) {
    this.items.set(item.id, item);
  }
}

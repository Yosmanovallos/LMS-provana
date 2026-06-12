/**
 * `pnpm --filter @lms/api seed` — stand-alone run of the demo scenario (master plan §14):
 * builds the in-memory container, seeds the three personas + QA path + 82% readiness user,
 * and prints what got created. The dev server (`pnpm dev`) seeds the same data on boot
 * unless SEED=false, so this script is mainly a quick sanity check / demo printout.
 */
import { buildContainer } from '../src/container';
import { seedDemoData } from '../src/app/seed';
import { unwrap } from '../src/modules/shared-kernel/result';

const container = buildContainer();
const seed = seedDemoData(container);

console.log('Seeded demo scenario:');
for (const p of seed.personas) {
  console.log(`  - ${p.displayName} (${p.role}) → x-user-id: ${p.userId}`);
}

const ana = seed.personas.find((p) => p.displayName === 'Ana Quintero')!;
const report = unwrap(
  container.promotion.queries.gapReport(ana.userId, { userId: ana.userId, role: 'employee' }),
)!;
console.log(`\nAna readiness: ${report.percentReady}% — missing:`);
for (const m of report.missing) console.log(`  - ${m.label}`);
console.log(`\nOutbox events recorded: ${container.outbox.all().length}`);

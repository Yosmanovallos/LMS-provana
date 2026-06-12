import { api } from '@/lib/api';
import { Persona } from '@/lib/types';
import { selectPersona } from './actions';

export const dynamic = 'force-dynamic';

const roleBlurb: Record<string, string> = {
  admin: 'Catalog, requirement sets, users, audit.',
  manager: 'Team, review queues, readiness, analytics.',
  employee: 'My Learning, assessments, evidence, career.',
};

export default async function PersonasPage() {
  const personas = await api<Persona[]>('/dev/personas');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <p className="kicker mb-2">AUTH_MODE=dev · Seeded personas</p>
      <h1 className="font-display text-4xl tracking-tight">
        Provana<span className="text-ember">.</span>
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-ink-soft">
        Pick who you are for this session. Every request carries this persona; the API enforces
        the actual permissions.
      </p>

      <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {personas.map((p) => (
          <form key={p.userId} action={selectPersona}>
            <input type="hidden" name="userId" value={p.userId} />
            <input type="hidden" name="role" value={p.role} />
            <input type="hidden" name="displayName" value={p.displayName} />
            <button
              type="submit"
              className="ledger-card group w-full p-5 text-left transition-colors hover:border-pine"
            >
              <p className="font-display text-lg group-hover:text-pine-deep">{p.displayName}</p>
              <p className="font-ledger text-[11px] uppercase tracking-wider text-ember">{p.role}</p>
              <p className="mt-2 text-xs text-ink-faint">{roleBlurb[p.role] ?? ''}</p>
            </button>
          </form>
        ))}
        {personas.length === 0 ? (
          <p className="col-span-full text-center text-sm text-ink-faint">
            No personas — start the API with seeding enabled (default): pnpm --filter @lms/api dev
          </p>
        ) : null}
      </div>
    </div>
  );
}

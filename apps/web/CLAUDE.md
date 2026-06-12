# Web conventions (Next.js 15 App Router)

- Route groups: `app/(employee)`, `app/(manager)`, `app/(admin)` — sidebar shell per group
  (EPAM Learn-style: sidebar nav, My Learning hub with ToDo/Active/History/Certificates tabs,
  courseware tree with completion tracking).
- Reads: server components calling `lib/api.ts` (typed fetch wrapper sending the dev persona
  headers). Mutations: server actions in `app/**/actions.ts` calling the same client, then
  `revalidatePath`.
- Persona: dev persona switcher stores `{userId, role}` in a cookie (`lms_persona`);
  `lib/persona.ts` reads it. No screen knows which AuthPort adapter the API uses.
- UI primitives in `components/ui/` (hand-rolled, Tailwind). No new UI libraries (ADR-010).
- Loading/error states: route-level `loading.tsx` where data is slow; errors surface the
  Result error message.

Commands: `pnpm --filter @lms/web dev` (port 3000, expects api on :3001) · `build` · `lint`.

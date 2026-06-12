import { api } from '@/lib/api';
import { requirePersona } from '@/lib/persona';
import { GapReport, MeView } from '@/lib/types';
import { GapReportPanel } from '@/components/readiness';
import { PageHeader } from '@/components/ui';

export default async function CareerPage() {
  const persona = await requirePersona();
  const [report, me] = await Promise.all([
    api<GapReport | null>(`/promotion/gap/${persona.userId}`),
    api<MeView>('/me'),
  ]);

  const level = me.profile?.jobRoleId
    ? `${me.profile.jobRoleId} · ${me.profile.jobLevelId}`
    : 'No role/level assigned yet';

  return (
    <>
      <PageHeader
        kicker={`Career · currently ${level}`}
        title="Promotion readiness"
        aside={
          me.profile?.currentLevelSince ? (
            <p className="font-ledger text-xs text-ink-faint">
              at level since {new Date(me.profile.currentLevelSince).toLocaleDateString()}
            </p>
          ) : undefined
        }
      />
      <GapReportPanel report={report} subjectName="you" />
    </>
  );
}

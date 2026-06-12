import Link from 'next/link';
import { api, nameMap, nameOf } from '@/lib/api';
import { GapReport } from '@/lib/types';
import { GapReportPanel } from '@/components/readiness';
import { PageHeader } from '@/components/ui';

export default async function MemberGapPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [report, names] = await Promise.all([api<GapReport | null>(`/promotion/gap/${userId}`), nameMap()]);
  const name = nameOf(names, userId);

  return (
    <>
      <PageHeader
        kicker="Promotion engine · gap report"
        title={name}
        aside={
          <Link href="/readiness" className="text-xs text-ink-soft underline decoration-dotted">
            ← Team readiness
          </Link>
        }
      />
      <GapReportPanel report={report} subjectName={name} />
    </>
  );
}

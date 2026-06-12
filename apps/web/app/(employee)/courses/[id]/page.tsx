import { api } from '@/lib/api';
import { CourseView, EnrollmentView } from '@/lib/types';
import { Card, PageHeader, Progress, StatusPill } from '@/components/ui';
import { completeLessonAction, enrollAction } from '../../learning-actions';

const lessonGlyph: Record<string, string> = { video: '▶', reading: '¶', exercise: '⚒' };

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, enrollments] = await Promise.all([
    api<CourseView | null>(`/catalog/courses/${id}`),
    api<EnrollmentView[]>('/my-learning/enrollments'),
  ]);
  if (!course) {
    return <PageHeader kicker="Course" title="Course not found" />;
  }

  const enrollment = enrollments.find((e) => e.targetKind === 'course' && e.targetId === id);
  const done = new Set(enrollment?.completedLessonIds ?? []);
  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <>
      <PageHeader
        kicker={`Course · v${course.version} · ${totalLessons} lessons`}
        title={course.title}
        aside={
          enrollment ? (
            <div className="flex items-center gap-3">
              <div className="w-44">
                <Progress pct={enrollment.percentComplete} />
              </div>
              <StatusPill status={enrollment.status} />
            </div>
          ) : (
            <form action={enrollAction.bind(null, 'course', course.id)}>
              <button type="submit" className="btn-primary">
                Enroll in this course
              </button>
            </form>
          )
        }
      />

      <div className="space-y-5">
        {course.modules.map((m, mi) => (
          <Card key={m.id} title={`Module ${mi + 1} — ${m.title}`}>
            <ul>
              {m.lessons.map((lesson) => {
                const completed = done.has(lesson.id);
                return (
                  <li key={lesson.id} className="ledger-row items-center">
                    <span className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border font-ledger text-[10px] ${
                          completed
                            ? 'border-verdict-ok bg-pine-wash text-verdict-ok'
                            : 'border-ink-line text-ink-faint'
                        }`}
                      >
                        {completed ? '✓' : lessonGlyph[lesson.type] ?? '·'}
                      </span>
                      <span className={completed ? 'text-ink-faint line-through decoration-ink-line' : ''}>
                        {lesson.title}
                      </span>
                      <span className="font-ledger text-[11px] text-ink-faint">
                        {lesson.type} · {lesson.durationMin}m
                      </span>
                    </span>
                    {enrollment && enrollment.status === 'active' && !completed ? (
                      <form action={completeLessonAction.bind(null, enrollment.enrollmentId, lesson.id, `/courses/${course.id}`)}>
                        <button type="submit" className="btn-quiet !py-0.5 text-xs">
                          Mark complete
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

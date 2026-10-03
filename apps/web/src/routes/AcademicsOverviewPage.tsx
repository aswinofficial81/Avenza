import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Progress } from '../components/ui/Progress';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { useAcademicsOverview } from '../features/academics/useAcademics';

export const AcademicsOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: overview, isLoading, error, refetch } = useAcademicsOverview();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <ErrorState
        title="Failed to load academics overview"
        description={error instanceof Error ? error.message : 'Unknown error'}
        onRetry={() => refetch()}
      />
    );
  }

  const {
    active_term,
    subjects,
    upcoming_exams,
    upcoming_assessments,
    overall_coverage,
  } = overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Academics Overview</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted-foreground font-mono">
              Phase 11
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Trustworthy source data for terms, subjects, syllabus coverage, assessments, and exams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/academics/terms')}
          >
            Manage Terms
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/academics/subjects')}
          >
            Manage Subjects
          </Button>
        </div>
      </div>

      {/* Empty State when no active term exists */}
      {!active_term && subjects.length === 0 && (
        <EmptyState
          icon={<GraduationCap className="w-10 h-10 text-muted-foreground" />}
          title="No academic data found"
          description="Create your first academic term and subjects to begin tracking syllabus coverage, assignments, and exam dates."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/academics/terms')}
            >
              Set Up First Term
            </Button>
          }
        />
      )}

      {(active_term || subjects.length > 0) && (
        <div className="space-y-6">
          {/* Top Row: Current Term & Overall Syllabus Coverage */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. What term am I in? */}
            <Card className="p-5 flex flex-col justify-between border-primary/30 bg-primary/5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-muted-foreground">Current Term</span>
                  <Badge variant="success">Active</Badge>
                </div>

                {active_term ? (
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-foreground tracking-tight">
                      {active_term.name}
                    </h3>
                    {active_term.code && (
                      <span className="text-xs font-mono text-muted-foreground">
                        Code: {active_term.code}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {active_term.start_date} &rarr; {active_term.end_date}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No current term designated.</p>
                )}
              </div>

              <div className="pt-4 border-t border-border-subtle flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => navigate('/academics/terms')}
                >
                  <span>Terms</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>

            {/* 5. How much syllabus is covered? */}
            <Card className="p-5 lg:col-span-2 space-y-3 bg-surface-2/60">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Syllabus Coverage</h3>
                    <span className="text-[11px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-surface">
                      Source Data
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Exposure and syllabus completion across enrolled subjects.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-3xl font-extrabold font-mono text-foreground">
                    {overall_coverage.coverage_percentage}%
                  </span>
                  <span className="text-xs text-muted-foreground ml-1.5">
                    ({overall_coverage.covered_topics}/{overall_coverage.total_topics} topics)
                  </span>
                </div>
              </div>

              <Progress value={overall_coverage.coverage_percentage} />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-subtle text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Covered: <strong className="text-foreground">{overall_coverage.covered_topics}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>In Progress: <strong className="text-foreground">{overall_coverage.in_progress_topics}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Review: <strong className="text-foreground">{overall_coverage.needs_review_topics}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Not Started: <strong className="text-foreground">{overall_coverage.not_started_topics}</strong></span>
                </div>
              </div>
            </Card>
          </div>

          {/* 2. What subjects am I taking? */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Enrolled Subjects ({subjects.length})</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => navigate('/academics/subjects')}
              >
                View all subjects &rarr;
              </Button>
            </div>

            {subjects.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No subjects added for this term yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((s) => {
                  const sCov = s.coverage || {
                    total_topics: 0,
                    covered_topics: 0,
                    coverage_percentage: 0,
                  };

                  return (
                    <Card
                      key={s.id}
                      className="p-4 hover:border-border transition-colors cursor-pointer"
                      onClick={() => navigate(`/academics/subjects/${s.id}`)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground tracking-tight hover:text-primary transition-colors">
                            {s.name}
                          </h4>
                          {s.code && (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {s.code}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                            <span>Syllabus Coverage</span>
                            <span>{sCov.covered_topics}/{sCov.total_topics} ({sCov.coverage_percentage}%)</span>
                          </div>
                          <Progress value={sCov.coverage_percentage} compact />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Grid: 3. Upcoming Exams & 4. Upcoming Assessments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 3. Upcoming Exams */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Upcoming Exams</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => navigate('/academics/exams')}
                >
                  View all &rarr;
                </Button>
              </div>

              {upcoming_exams.length === 0 ? (
                <Card className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">No upcoming exams scheduled.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {upcoming_exams.map((e) => (
                    <Card key={e.id} className="p-3.5 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{e.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(e.exam_date).toLocaleDateString()}
                          </span>
                          {e.duration_minutes && <span>{e.duration_minutes}m</span>}
                          {e.location && <span>Loc: {e.location}</span>}
                        </div>
                      </div>
                      <Badge variant="warning">{e.exam_type}</Badge>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Upcoming Assessments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Upcoming Assessments</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => navigate('/academics/assessments')}
                >
                  View all &rarr;
                </Button>
              </div>

              {upcoming_assessments.length === 0 ? (
                <Card className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">No pending assessments due.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {upcoming_assessments.map((a) => (
                    <Card key={a.id} className="p-3.5 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                          {a.due_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due: {new Date(a.due_at).toLocaleDateString()}
                            </span>
                          )}
                          <span className="uppercase text-[10px]">{a.assessment_type}</span>
                        </div>
                      </div>
                      <Badge variant={a.status === 'in_progress' ? 'info' : 'default'}>
                        {a.status}
                      </Badge>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

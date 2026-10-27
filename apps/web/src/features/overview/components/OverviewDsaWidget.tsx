import React from 'react';
import { Link } from 'react-router-dom';
import { Code2, ArrowRight, RotateCcw, CheckCircle, BookOpen, Sparkles } from 'lucide-react';
import { useDsaOverview } from '../../dsa/hooks/use-dsa-overview';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';

export const OverviewDsaWidget: React.FC = () => {
  const { data: dsaOverview, isLoading, isError, error, refetch } = useDsaOverview();

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </div>
          <Skeleton className="h-16 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold">DSA Progress</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ErrorState
            title="Unable to load DSA overview"
            description={(error as Error)?.message || 'Failed to fetch DSA progress.'}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const totalProblems = dsaOverview?.total_problems ?? 0;
  const solvedProblems = dsaOverview?.solved_problems ?? 0;
  const revisionDue = dsaOverview?.revision_due_count ?? 0;
  const attempted = dsaOverview?.attempted_problems ?? 0;
  const recommended = dsaOverview?.recommended_problem;

  const hasData = totalProblems > 0 || attempted > 0;

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">DSA Progress</CardTitle>
            </div>
            <Link to="/dsa">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                Open DSA
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {hasData ? (
            <>
              {/* DSA Quick Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle flex flex-col">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" /> Solved
                  </span>
                  <span className="text-xl font-bold font-mono text-foreground mt-0.5">
                    {solvedProblems}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    of {totalProblems} problems
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle flex flex-col">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-amber-500" /> Due
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    {revisionDue}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">revisions due</span>
                </div>

                <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle flex flex-col">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-sky-500" /> Attempts
                  </span>
                  <span className="text-xl font-bold font-mono text-foreground mt-0.5">
                    {attempted}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">total attempts</span>
                </div>
              </div>

              {/* Recommended Problem if available */}
              {recommended ? (
                <div className="p-3 rounded-lg bg-surface border border-border-subtle space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Recommended Revision
                    </span>
                    <Badge variant="info" size="sm">Smart Pick</Badge>
                  </div>
                  <Link
                    to="/dsa"
                    className="text-xs font-semibold text-foreground hover:text-primary transition-colors block line-clamp-1"
                  >
                    {recommended.title}
                  </Link>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {recommended.reason}
                  </p>
                </div>
              ) : revisionDue > 0 ? (
                <div className="flex items-center justify-between p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                  <span className="font-medium">
                    {revisionDue} problem{revisionDue > 1 ? 's' : ''} ready for spaced repetition
                  </span>
                  <Link to="/dsa">
                    <Button variant="outline" size="sm" className="text-[11px] h-6 px-2 border-amber-500/30">
                      Review
                    </Button>
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<Code2 className="w-6 h-6 text-muted-foreground" />}
              title="No DSA problems tracked"
              description="Log practice problems and spaced repetition reviews to build technical interview mastery."
              action={
                <Link to="/dsa">
                  <Button variant="outline" size="sm" className="text-xs">
                    Explore DSA
                  </Button>
                </Link>
              }
              className="py-6 border-none bg-transparent"
            />
          )}
        </CardContent>
      </div>
    </Card>
  );
};


import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Code2, BookOpen, ClipboardCheck } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDsaProblems } from '@/features/dsa/hooks/use-dsa-problems';

const primaryLink =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg ' +
  'bg-primary px-3 text-xs font-medium text-primary-foreground ' +
  'shadow-sm transition-opacity hover:opacity-90';

const secondaryLink =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg ' +
  'border border-border px-3 text-xs font-medium text-foreground ' +
  'transition-colors hover:bg-surface-2';

export const DsaProblemsList: React.FC = () => {
  const { data, isLoading, error } = useDsaProblems();

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>DSA Problems</CardTitle>
          <p className="text-xs text-muted-foreground" role="status">
            Loading problems...
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>DSA Problems</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/5 p-4"
          >
            <p className="text-sm text-danger">
              Error loading problems: {error.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const problems = data ?? [];

  return (
    <Card className="w-full">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          <CardTitle>DSA Problems</CardTitle>
          <p className="text-xs text-muted-foreground">
            Track your practice, attempts, and revision progress.
          </p>
        </div>

        <Link to="/dsa/problems/create" className={primaryLink}>
          <Plus className="h-3.5 w-3.5" />
          Add Problem
        </Link>
      </CardHeader>

      <CardContent className="pt-2">
        {problems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle px-5 py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 text-muted-foreground">
              <Code2 className="h-6 w-6" />
            </div>

            <h4 className="text-sm font-semibold text-foreground">
              No DSA problems yet
            </h4>

            <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              No problems found. Create your first DSA problem to get started.
            </p>

            <Link
              to="/dsa/problems/create"
              className={`${primaryLink} mt-5`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first problem
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {problems.map((problem) => (
              <article
                key={problem.id}
                className="rounded-xl border border-border-subtle bg-surface-2/40 p-4 transition-colors hover:border-border"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <h3 className="break-words text-sm font-semibold text-foreground">
                      {problem.title}
                    </h3>

                    <span className="inline-flex rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground">
                      {problem.difficulty}
                    </span>
                  </div>

                  <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
                    <p>
                      Solved: {problem.solved_count}/{problem.attempt_count}
                    </p>

                    {problem.next_review_at && (
                      <p className="mt-1">
                        Revision due:{' '}
                        {new Date(
                          problem.next_review_at
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
                  <Link
                    to={`/dsa/problems/${problem.id}`}
                    className={secondaryLink}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    View Details
                  </Link>

                  <Link
                    to={`/dsa/problems/${problem.id}/attempt`}
                    className={secondaryLink}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Record Attempt
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

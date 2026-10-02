import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFocusSessions } from '../features/focus/useFocusSession';
import { Button } from '../components/ui/Button';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import {
  History,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { FocusSessionStatus } from '@avenza/shared';

export const FocusHistoryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FocusSessionStatus | ''>('');

  const { data: paginatedData, isLoading, isError, refetch } = useFocusSessions({
    page,
    limit: 15,
    status: statusFilter || undefined,
  });

  const sessions = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/overview' },
              { label: 'Focus', href: '/focus' },
              { label: 'History', isCurrent: true },
            ]}
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Focus Session History
          </h1>
          <p className="text-xs text-muted-foreground">
            A chronological record of verified intentional execution.
          </p>
        </div>

        <Link to="/focus">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Active Focus</span>
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold text-muted-foreground">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as FocusSessionStatus | '');
              setPage(1);
            }}
            className="p-1.5 text-xs rounded-lg border border-border bg-background text-foreground"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="active">Active</option>
          </select>
        </div>

        {pagination && (
          <div className="text-xs text-muted-foreground">
            Showing {sessions.length} of {pagination.total} sessions
          </div>
        )}
      </div>

      {/* History Table or States */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load focus history.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border text-center">
          <EmptyState
            title="No focus sessions recorded"
            description="Completed or cancelled focus sessions will appear here as execution evidence."
            icon={<History className="h-6 w-6 stroke-[1.5] text-primary" />}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Task</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Planned</th>
                <th className="py-3 px-4">Actual</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sessions.map((session) => {
                const isCompleted = session.status === 'completed';
                const isCancelled = session.status === 'cancelled';
                const isActive = session.status === 'active';

                return (
                  <tr key={session.id} className="hover:bg-muted/30 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {new Date(session.started_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(session.started_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Task */}
                    <td className="py-3.5 px-4 min-w-[200px]">
                      {session.task ? (
                        <div>
                          <Link
                            to={`/tasks/${session.task.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                          >
                            {session.task.title}
                          </Link>
                          {session.notes && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1 italic">
                              "{session.notes}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">No task</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="capitalize px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60 font-medium">
                        {session.session_type.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Planned */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground font-mono">
                      {session.planned_minutes}m
                    </td>

                    {/* Actual */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono font-semibold">
                      {session.actual_minutes !== null ? (
                        <span
                          className={
                            isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {session.actual_minutes}m
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isActive && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          Active
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border">
                          <XCircle className="w-3 h-3" />
                          Cancelled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </Button>

          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="gap-1 text-xs"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

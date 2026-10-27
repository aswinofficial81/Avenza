import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDsaProblemDetail } from '../hooks/use-dsa-problem-detail';
import { useDsaApi } from '../../../lib/api/dsa';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ArrowLeft, Clock, Calendar, CheckCircle2, XCircle, AlertCircle, PlusCircle, ExternalLink } from 'lucide-react';

export const DsaProblemDetailPage: React.FC = () => {
  const params = useParams<{ problemId?: string; id?: string }>();
  const problemId = params.problemId || params.id;
  const { data, isLoading, error, refetch } = useDsaProblemDetail(problemId);
  const dsaApi = useDsaApi();

  const [showAttemptForm, setShowAttemptForm] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState<'attempted' | 'solved' | 'failed' | 'abandoned'>('solved');
  const [solveTime, setSolveTime] = useState<number | ''>(15);
  const [language, setLanguage] = useState('TypeScript');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="dsa-detail-loading">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-surface-2 animate-pulse rounded" />
          <div className="h-8 w-64 bg-surface-2 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 bg-surface-2 animate-pulse rounded-lg" />
          <div className="h-64 bg-surface-2 animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12" data-testid="dsa-detail-error">
        <ErrorState
          title="Error Loading Problem"
          description={error.message || 'An unexpected error occurred.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!data || !data.problem) {
    return (
      <div className="py-12" data-testid="dsa-detail-not-found">
        <EmptyState
          title="Problem Not Found"
          description="The requested DSA problem could not be found or has been removed."
          action={
            <Link to="/dsa/problems">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Problems
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { problem, topics, skills, goals, tasks, recent_attempts } = data;

  const handleRecordAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemId) return;

    try {
      setIsSubmitting(true);
      setFormError(null);

      await dsaApi.createAttempt(problemId, {
        status: attemptStatus,
        solve_time_minutes: attemptStatus === 'attempted' || solveTime === '' ? null : Number(solveTime),
        language: language.trim() || null,
        notes: notes.trim() || null,
        occurred_at: new Date().toISOString(),
      });

      setShowAttemptForm(false);
      setNotes('');
      await refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to record attempt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return <Badge variant="success">Easy</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'hard':
        return <Badge variant="danger">Hard</Badge>;
      default:
        return <Badge>{difficulty}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'solved':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'attempted':
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const solveRate = problem.attempt_count > 0
    ? Math.round((problem.solved_count / problem.attempt_count) * 100)
    : 0;

  return (
    <div className="space-y-6" data-testid="dsa-detail-populated">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Link to="/dsa/problems" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4 inline mr-1" />
              DSA Problems
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{problem.title}</h1>
            {getDifficultyBadge(problem.difficulty)}
            <Badge variant="secondary" className="capitalize">{problem.source}</Badge>
            <Badge variant={problem.status === 'active' ? 'secondary' : 'default'} className="capitalize">
              {problem.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link to={`/dsa/problems/${problemId}/edit`}>
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAttemptForm(!showAttemptForm)}
          >
            <PlusCircle className="h-4 w-4 mr-1.5" />
            {showAttemptForm ? 'Close Form' : 'Record Attempt'}
          </Button>
        </div>
      </div>

      {/* Record Attempt Form Panel */}
      {showAttemptForm && (
        <Card className="border-primary/40 bg-surface/80">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Record New Attempt</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecordAttempt} className="space-y-4" data-testid="record-attempt-form">
              {formError && (
                <div className="p-3 text-sm bg-danger/10 text-danger rounded-md border border-danger/20">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                  <Select
                    value={attemptStatus}
                    onChange={(e) => setAttemptStatus(e.target.value as 'attempted' | 'solved' | 'failed' | 'abandoned')}
                  >
                    <option value="solved">Solved</option>
                    <option value="failed">Failed</option>
                    <option value="attempted">Attempted (In Progress)</option>
                    <option value="abandoned">Abandoned</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Solve Time (Minutes)</label>
                  <Input
                    type="number"
                    min="1"
                    max="1440"
                    placeholder="e.g. 20"
                    value={solveTime}
                    disabled={attemptStatus === 'attempted'}
                    onChange={(e) => setSolveTime(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Language</label>
                  <Input
                    type="text"
                    placeholder="e.g. TypeScript, Python"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Notes / Approach</label>
                <Textarea
                  rows={2}
                  placeholder="Record your thoughts, complexities (e.g. O(n) time, O(1) space), edge cases..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAttemptForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Save Attempt'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Description & Attempts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Problem Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {problem.description || 'No description provided.'}
              </div>

              {problem.external_url && (
                <div className="pt-3 border-t text-sm">
                  <a
                    href={problem.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    View Original Problem on External Platform
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attempt History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Attempt History</CardTitle>
              <Badge variant="secondary">{recent_attempts.length} attempts</Badge>
            </CardHeader>
            <CardContent>
              {recent_attempts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No attempts recorded yet. Click "Record Attempt" above to log your execution history.
                </div>
              ) : (
                <div className="space-y-3" data-testid="attempt-history-list">
                  {recent_attempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="p-3.5 rounded-lg border border-border bg-surface-1 flex flex-col md:flex-row justify-between items-start md:items-center gap-2"
                    >
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(attempt.status)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm capitalize">{attempt.status}</span>
                            {attempt.language && (
                              <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted-foreground">
                                {attempt.language}
                              </span>
                            )}
                            {attempt.solve_time_minutes && (
                              <span className="text-xs text-muted-foreground">
                                • {attempt.solve_time_minutes} mins
                              </span>
                            )}
                          </div>
                          {attempt.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {attempt.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center shrink-0">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        {new Date(attempt.occurred_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Spaced Repetition, Performance, Links */}
        <div className="space-y-6">
          {/* Spaced Repetition Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                Spaced Repetition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Review Stage</span>
                <span className="font-semibold">
                  {problem.review_stage === 0
                    ? 'Unscheduled (Stage 0)'
                    : `Stage ${problem.review_stage} (${problem.review_stage === 1 ? '+2d' : problem.review_stage === 2 ? '+7d' : '+21d'})`}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Next Review Due</span>
                <span className="font-medium">
                  {problem.next_review_at
                    ? new Date(problem.next_review_at).toLocaleDateString()
                    : 'Not scheduled'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Successful Revisions</span>
                <span className="font-medium">{problem.revision_count}</span>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-2 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">Total Attempts</div>
                  <div className="text-xl font-bold mt-0.5">{problem.attempt_count}</div>
                </div>
                <div className="p-3 bg-surface-2 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">Solved Count</div>
                  <div className="text-xl font-bold mt-0.5 text-emerald-500">{problem.solved_count}</div>
                </div>
                <div className="p-3 bg-surface-2 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">Failed Count</div>
                  <div className="text-xl font-bold mt-0.5 text-red-500">{problem.failed_count}</div>
                </div>
                <div className="p-3 bg-surface-2 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">Solve Rate</div>
                  <div className="text-xl font-bold mt-0.5">{solveRate}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connected Entities: Topics, Skills, Goals, Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Connected Learning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Topics */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Topics</div>
                {topics.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No topics linked</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map(t => (
                      <Badge key={t.id} variant="secondary">{t.name}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Linked Skills (Phase 12)</div>
                {skills.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No skills linked</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map(s => (
                      <Badge key={s.id} variant="secondary">{s.name}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Goals */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Target Goals</div>
                {goals.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No goals linked</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {goals.map(g => (
                      <Badge key={g.id} variant="secondary">{g.title}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Associated Tasks</div>
                {tasks.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No tasks linked</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tasks.map(t => (
                      <Badge key={t.id} variant="secondary">{t.title}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
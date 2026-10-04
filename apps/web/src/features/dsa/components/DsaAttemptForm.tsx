import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useDsaApi } from '@/lib/api/dsa';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';
import type { DsaProblemDto } from '@avenza/shared';

export const DsaAttemptForm: React.FC = () => {
  const navigate = useNavigate();
  const { problemId } = useParams<{ problemId: string }>();
  const dsaApi = useDsaApi();

  const [problem, setProblem] = useState<DsaProblemDto | null>(null);

  const {
    register,
    handleSubmit,
    reset: _reset,
    formState: { errors, isLoading: _isLoading, isSubmitting },
  } = useForm<{
    status: 'attempted' | 'solved' | 'failed' | 'abandoned';
    started_at: string | null;
    submitted_at: string | null;
    occurred_at: string;
    solve_time_minutes: number | null;
    language: string | null;
    notes: string | null;
  }>({
    defaultValues: {
      status: 'attempted',
      started_at: null,
      submitted_at: null,
      occurred_at: new Date().toISOString(),
      solve_time_minutes: null,
      language: null,
      notes: null,
    },
  });

  const loadProblem = async () => {
    if (!problemId) {
      setProblem(null);
      return;
    }
    try {
      const problemData = await dsaApi.getProblem(problemId);
      setProblem(problemData);
    } catch (error) {
      console.error('Failed to load problem:', error);
    }
  };

  React.useEffect(() => {
    loadProblem();
  }, [problemId, dsaApi]);

  const onSubmit = handleSubmit(async (data) => {
    if (!problemId) {
      console.error('Problem ID is missing');
      return;
    }
    try {
      // Transform form data: convert undefined to null for optional fields
      const transformedData = {
        ...data,
        started_at: data.started_at ?? null,
        submitted_at: data.submitted_at ?? null,
        solve_time_minutes: data.solve_time_minutes ?? null,
        language: data.language ?? null,
        notes: data.notes ?? null,
      };
      await dsaApi.createAttempt(problemId, transformedData);
      navigate(`/dsa/problems/${problemId}`);
    } catch (error) {
      console.error('Failed to save attempt:', error);
    }
  });

  if (!problem) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Loading problem...</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="animate-pulse">Loading problem details...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-start">
        <CardTitle>Record Attempt</CardTitle>
        <div className="text-sm text-muted-foreground">
          Problem: {problem.title}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Status</label>
            <Select
              options={[
                { label: 'Attempted', value: 'attempted' },
                { label: 'Solved', value: 'solved' },
                { label: 'Failed', value: 'failed' },
                { label: 'Abandoned', value: 'abandoned' }
              ]}
              {...register('status')}
            />
            {errors.status && (
              <p className="text-sm text-destructive mt-1">{errors.status.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Started At (optional)</label>
              <Input
                type="datetime-local"
                {...register('started_at')}
                className="w-full"
              />
              {errors.started_at && (
                <p className="text-sm text-destructive mt-1">{errors.started_at.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Submitted At (optional)</label>
              <Input
                type="datetime-local"
                {...register('submitted_at')}
                className="w-full"
              />
              {errors.submitted_at && (
                <p className="text-sm text-destructive mt-1">{errors.submitted_at.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Occurred At</label>
            <Input
              type="datetime-local"
              {...register('occurred_at')}
              className="w-full"
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
            {errors.occurred_at && (
              <p className="text-sm text-destructive mt-1">{errors.occurred_at.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Solve Time (minutes, optional)</label>
              <Input
                type="number"
                {...register('solve_time_minutes', {
                  min: {
                    value: 1,
                    message: 'Solve time must be at least 1 minute',
                  },
                  max: {
                    value: 1440,
                    message: 'Solve time cannot exceed 1440 minutes (24 hours)',
                  },
                })}
                className="w-full"
              />
              {errors.solve_time_minutes && (
                <p className="text-sm text-destructive mt-1">{errors.solve_time_minutes.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Language (optional)</label>
              <Input
                {...register('language')}
                className="w-full"
                placeholder="e.g., Python, Java, C++"
                maxLength={40}
              />
              {errors.language && (
                <p className="text-sm text-destructive mt-1">{errors.language.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Notes (optional)</label>
            <Textarea
              {...register('notes')}
              className="w-full min-h-[80px]"
              placeholder="Enter any notes about your attempt"
              maxLength={2000}
            />
            {errors.notes && (
              <p className="text-sm text-destructive mt-1">{errors.notes.message}</p>
            )}
          </div>
        </form>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={() => navigate(`/dsa/problems/${problemId}`)}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Saving...' : 'Record Attempt'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
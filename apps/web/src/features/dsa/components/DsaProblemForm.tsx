import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useDsaApi } from '@/lib/api/dsa';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';

export const DsaProblemForm: React.FC = () => {
  const navigate = useNavigate();
  const { problemId } = useParams<{ problemId?: string }>();
  const isEditMode = !!problemId;
  const dsaApi = useDsaApi();

  const {
    register,
    handleSubmit,
    reset: _reset,
    formState: { errors, isLoading: _isLoading, isSubmitting },
  } = useForm<{
    title: string;
    slug: string;
    description: string | null;
    difficulty: 'easy' | 'medium' | 'hard';
    source: 'user' | 'system' | 'imported';
    external_url: string | null;
    estimated_minutes: number | null;
  }>({
    defaultValues: {
      title: '',
      slug: '',
      description: null,
      difficulty: 'medium',
      source: 'user',
      external_url: null,
      estimated_minutes: null,
    },
  });

  const loadProblemData = async () => {
    if (!problemId) return;

    try {
      const problem = await dsaApi.getProblem(problemId);
      _reset({
        title: problem.title,
        slug: problem.slug,
        description: problem.description,
        difficulty: problem.difficulty,
        source: problem.source,
        external_url: problem.external_url,
        estimated_minutes: problem.estimated_minutes,
      });
    } catch (error) {
      console.error('Failed to load problem:', error);
    }
  };

  React.useEffect(() => {
    if (isEditMode) {
      loadProblemData();
    }
  }, [isEditMode, problemId, _reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEditMode && problemId) {
        await dsaApi.updateProblem(problemId, data);
      } else {
        await dsaApi.createProblem(data);
      }
      navigate(isEditMode ? '/dsa/problems' : '/dsa/problems');
    } catch (error) {
      console.error('Failed to save problem:', error);
    }
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Problem' : 'Add Problem'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Title</label>
            <Input
              {...register('title', {
                required: 'Title is required',
                maxLength: {
                  value: 200,
                  message: 'Title cannot exceed 200 characters',
                },
              })}
              defaultValue=""
              className="w-full"
              placeholder="Enter problem title"
            />
            {errors.title && (
              <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Slug (optional)</label>
            <Input
              {...register('slug', {
                maxLength: {
                  value: 120,
                  message: 'Slug cannot exceed 120 characters',
                },
                pattern: {
                  value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                  message: 'Slug must be lowercase alphanumeric separated by hyphens',
                },
              })}
              defaultValue=""
              className="w-full"
              placeholder="Enter slug (auto-generated from title if left blank)"
            />
            {errors.slug && (
              <p className="text-sm text-destructive mt-1">{errors.slug.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Description (optional)</label>
            <Textarea
              {...register('description')}
              className="w-full min-h-[80px]"
              placeholder="Enter problem description"
              maxLength={5000}
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Difficulty</label>
              <Select
                options={[
                  { label: 'Easy', value: 'easy' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'Hard', value: 'hard' }
                ]}
                {...register('difficulty')}
              />
              {errors.difficulty && (
                <p className="text-sm text-destructive mt-1">{errors.difficulty.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Source</label>
              <Select
                options={[
                  { label: 'User', value: 'user' },
                  { label: 'System', value: 'system' },
                  { label: 'Imported', value: 'imported' }
                ]}
                {...register('source')}
              />
              {errors.source && (
                <p className="text-sm text-destructive mt-1">{errors.source.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">External URL (optional)</label>
            <Input
              {...register('external_url')}
              className="w-full"
              placeholder="Enter external URL (LeetCode, Codeforces, etc.)"
              maxLength={1000}
            />
            {errors.external_url && (
              <p className="text-sm text-destructive mt-1">{errors.external_url.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Estimated Time (minutes, optional)</label>
            <Input
              type="number"
              {...register('estimated_minutes', {
                min: {
                  value: 1,
                  message: 'Estimated time must be at least 1 minute',
                },
                max: {
                  value: 1440,
                  message: 'Estimated time cannot exceed 1440 minutes (24 hours)',
                },
              })}
              className="w-full"
              placeholder="Enter estimated time in minutes"
            />
            {errors.estimated_minutes && (
              <p className="text-sm text-destructive mt-1">{errors.estimated_minutes.message}</p>
            )}
          </div>
        </form>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={() => navigate(isEditMode ? '/dsa/problems' : '/dsa/problems')}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Problem' : 'Add Problem'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
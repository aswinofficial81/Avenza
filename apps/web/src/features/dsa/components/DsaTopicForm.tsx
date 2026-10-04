import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useDsaApi } from '@/lib/api/dsa';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';

export const DsaTopicForm: React.FC = () => {
  const navigate = useNavigate();
  const { topicId } = useParams<{ topicId?: string }>();
  const isEditMode = !!topicId;
  const dsaApi = useDsaApi();

  const {
    register,
    handleSubmit,
    reset: _reset,
    formState: { errors, isLoading: _isLoading, isSubmitting },
  } = useForm<{
    name: string;
    slug: string;
    parent_topic_id: string | null;
    status: 'active' | 'archived';
  }>({
    defaultValues: {
      name: '',
      slug: '',
      parent_topic_id: null,
      status: 'active',
    },
  });

  const loadTopicData = async () => {
    if (!topicId) return;

    try {
      const topic = await dsaApi.getTopic(topicId);
      _reset({
        name: topic.name,
        slug: topic.slug,
        parent_topic_id: topic.parent_topic_id,
        status: topic.status,
      });
    } catch (error) {
      console.error('Failed to load topic:', error);
    }
  };

  React.useEffect(() => {
    if (isEditMode) {
      loadTopicData();
    }
  }, [isEditMode, topicId, _reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEditMode && topicId) {
        await dsaApi.updateTopic(topicId, data);
      } else {
        await dsaApi.createTopic(data);
      }
      navigate(isEditMode ? '/dsa/topics' : '/dsa/topics');
    } catch (error) {
      console.error('Failed to save topic:', error);
    }
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Topic' : 'Add Topic'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1">Name</label>
            <Input
              {...register('name', {
                required: 'Name is required',
                maxLength: {
                  value: 100,
                  message: 'Name cannot exceed 100 characters',
                },
              })}
              defaultValue=""
              className="w-full"
              placeholder="Enter topic name"
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
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
              placeholder="Enter slug (auto-generated from name if left blank)"
            />
            {errors.slug && (
              <p className="text-sm text-destructive mt-1">{errors.slug.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Parent Topic (optional)</label>
              <Select
                options={[
                  { label: 'None', value: '' }
                  // In a real implementation, we would fetch topics here and map them to options
                ]}
                {...register('parent_topic_id')}
              />
              {errors.parent_topic_id && (
                <p className="text-sm text-destructive mt-1">{errors.parent_topic_id.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1">Status</label>
              <Select
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Archived', value: 'archived' }
                ]}
                {...register('status')}
              />
              {errors.status && (
                <p className="text-sm text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>
        </form>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={() => navigate(isEditMode ? '/dsa/topics' : '/dsa/topics')}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Topic' : 'Add Topic'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
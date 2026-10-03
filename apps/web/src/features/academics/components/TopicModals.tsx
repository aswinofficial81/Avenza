import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { useCreateTopic, useUpdateTopic } from '../useAcademics';
import type {
  SubjectTopicDto,
  TopicImportance,
  TopicResource,
  TopicStatus,
} from '@avenza/shared';

interface CreateTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  nextOrderIndex?: number;
}

export const CreateTopicModal: React.FC<CreateTopicModalProps> = ({
  isOpen,
  onClose,
  subjectId,
  nextOrderIndex = 1,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orderIndex, setOrderIndex] = useState<number>(nextOrderIndex);
  const [status, setStatus] = useState<TopicStatus>('not_started');
  const [importance, setImportance] = useState<TopicImportance>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createTopic = useCreateTopic();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Topic name is required');
      return;
    }

    const resources: TopicResource[] = [];
    if (resourceTitle.trim()) {
      resources.push({
        title: resourceTitle.trim(),
        url: resourceUrl.trim() || undefined,
        type: 'notes',
      });
    }

    try {
      await createTopic.mutateAsync({
        subjectId,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          order_index: Number(orderIndex) || 0,
          status,
          importance,
          estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
          resources,
          notes: null,
        },
      });
      onClose();
      setName('');
      setDescription('');
      setEstimatedMinutes('');
      setResourceTitle('');
      setResourceUrl('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create topic');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Syllabus Topic" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Input
          label="Topic Name *"
          placeholder="e.g. Relational Normalization (3NF & BCNF)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Order Index"
            type="number"
            min="0"
            value={orderIndex}
            onChange={(e) => setOrderIndex(parseInt(e.target.value, 10) || 0)}
          />
          <Select
            label="Coverage Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TopicStatus)}
            options={[
              { value: 'not_started', label: 'Not Started' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'covered', label: 'Covered' },
              { value: 'needs_review', label: 'Needs Review' },
            ]}
          />
          <Select
            label="Importance"
            value={importance}
            onChange={(e) => setImportance(e.target.value as TopicImportance)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
        </div>

        <Input
          label="Estimated Study Minutes (Optional)"
          type="number"
          min="0"
          placeholder="e.g. 90"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
        />

        <Textarea
          label="Description / Scope (Optional)"
          placeholder="Key concepts, algorithms, subtopics covered..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <div className="p-3 bg-surface-2 rounded border border-border-subtle space-y-2">
          <p className="text-xs font-semibold text-foreground">Resource Reference (Optional)</p>
          <Input
            placeholder="Resource Title (e.g. Textbook Ch. 4 or Slides)"
            value={resourceTitle}
            onChange={(e) => setResourceTitle(e.target.value)}
          />
          <Input
            placeholder="URL (optional)"
            type="url"
            value={resourceUrl}
            onChange={(e) => setResourceUrl(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={createTopic.isPending}>
            {createTopic.isPending ? 'Adding...' : 'Add Topic'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface EditTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: SubjectTopicDto;
}

export const EditTopicModal: React.FC<EditTopicModalProps> = ({ isOpen, onClose, topic }) => {
  const [name, setName] = useState(topic.name);
  const [description, setDescription] = useState(topic.description || '');
  const [orderIndex, setOrderIndex] = useState<number>(topic.order_index);
  const [status, setStatus] = useState<TopicStatus>(topic.status);
  const [importance, setImportance] = useState<TopicImportance>(topic.importance);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    topic.estimated_minutes != null ? String(topic.estimated_minutes) : ''
  );
  const [error, setError] = useState<string | null>(null);

  const updateTopic = useUpdateTopic();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Topic name is required');
      return;
    }

    try {
      await updateTopic.mutateAsync({
        id: topic.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          order_index: Number(orderIndex) || 0,
          status,
          importance,
          estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        },
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update topic');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Topic" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Input
          label="Topic Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Order Index"
            type="number"
            min="0"
            value={orderIndex}
            onChange={(e) => setOrderIndex(parseInt(e.target.value, 10) || 0)}
          />
          <Select
            label="Coverage Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TopicStatus)}
            options={[
              { value: 'not_started', label: 'Not Started' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'covered', label: 'Covered' },
              { value: 'needs_review', label: 'Needs Review' },
            ]}
          />
          <Select
            label="Importance"
            value={importance}
            onChange={(e) => setImportance(e.target.value as TopicImportance)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
        </div>

        <Input
          label="Estimated Study Minutes"
          type="number"
          min="0"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={updateTopic.isPending}>
            {updateTopic.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
